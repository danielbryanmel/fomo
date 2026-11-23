-- ============================================================================
-- FOMO · 0016 · Social 6
--  1) story: curtir (o autor vê quem curtiu) e responder (vira mensagem no direct)
--  2) grupos no direct: conversa com nome e várias pessoas
-- ============================================================================

-- 1) ----------------------------------------------------------------- curtir / responder story
create table if not exists public.story_likes (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
create index if not exists story_likes_user_idx on public.story_likes (user_id);
alter table public.story_likes enable row level security;
create policy story_likes_select on public.story_likes for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from stories s where s.id = story_id and s.author_id = (select auth.uid())));
revoke insert, update, delete on public.story_likes from anon, authenticated;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'like', 'comment', 'achievement', 'event_approved', 'moderation',
  'message', 'group_invite', 'group_response', 'event_reminder', 'group_poll', 'arrived_home', 'story_like'));

create or replace function public.toggle_story_like(p_story uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); s stories;
begin
  select * into s from stories where id = p_story;
  if not found or not private.can_view_story(s.author_id, s.visibility, s.expires_at) then raise exception 'forbidden' using errcode = '42501'; end if;
  if s.author_id = uid then raise exception 'invalid_target' using errcode = '22023'; end if;
  if exists (select 1 from story_likes where story_id = p_story and user_id = uid) then
    delete from story_likes where story_id = p_story and user_id = uid;
    return false;
  end if;
  insert into story_likes (story_id, user_id) values (p_story, uid);
  insert into story_views (story_id, viewer_id) values (p_story, uid) on conflict do nothing;
  if not exists (select 1 from notifications where user_id = s.author_id and actor_id = uid and type = 'story_like' and entity_id = p_story) then
    insert into notifications (user_id, type, actor_id, entity_type, entity_id) values (s.author_id, 'story_like', uid, 'story', p_story);
  end if;
  return true;
end $$;
revoke execute on function public.toggle_story_like(uuid) from public, anon;
grant execute on function public.toggle_story_like(uuid) to authenticated;

-- resposta de story = mensagem no direct com um rótulo ("Respondeu ao seu story · legenda")
alter table public.messages add column if not exists story_id uuid references public.stories (id) on delete set null;
alter table public.messages add column if not exists reply_label text check (reply_label is null or char_length(reply_label) <= 160);
create index if not exists messages_story_idx on public.messages (story_id) where story_id is not null;

create or replace function public.reply_story(p_story uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); s stories; cid uuid;
begin
  select * into s from stories where id = p_story;
  if not found or not private.can_view_story(s.author_id, s.visibility, s.expires_at) then raise exception 'forbidden' using errcode = '42501'; end if;
  if s.author_id = uid then raise exception 'invalid_target' using errcode = '22023'; end if;
  if coalesce(trim(p_body), '') = '' or char_length(p_body) > 2000 then raise exception 'invalid_message' using errcode = '22023'; end if;
  cid := public.start_conversation(s.author_id);
  insert into messages (conversation_id, sender_id, body, story_id, reply_label)
  values (cid, uid, trim(p_body), p_story, left('Respondeu ao story' || coalesce(' · ' || s.caption, ''), 160));
  insert into story_views (story_id, viewer_id) values (p_story, uid) on conflict do nothing;
  return cid;
end $$;
revoke execute on function public.reply_story(uuid, text) from public, anon;
grant execute on function public.reply_story(uuid, text) to authenticated;

-- bandeja passa a dizer se eu curti (e, nos meus stories, quantas curtidas)
create or replace function public.stories_tray()
returns jsonb language sql stable security definer set search_path = public, private as $$
  with vis as (
    select s.* from stories s
    where s.expires_at > now()
      and (s.author_id = auth.uid()
           or (exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = s.author_id and f.status = 'accepted')
               and private.can_view_item(auth.uid(), s.author_id, s.visibility)))
  ), per as (
    select v.author_id,
      jsonb_agg(jsonb_build_object(
        'id', v.id, 'path', v.storage_path, 'width', v.width, 'height', v.height, 'caption', v.caption,
        'isDual', v.is_dual, 'createdAt', v.created_at, 'expiresAt', v.expires_at, 'visibility', v.visibility,
        'event', (select jsonb_build_object('id', e.id, 'title', e.title) from events e where e.id = v.event_id),
        'seen', exists (select 1 from story_views sv where sv.story_id = v.id and sv.viewer_id = auth.uid()),
        'liked', exists (select 1 from story_likes sl where sl.story_id = v.id and sl.user_id = auth.uid()),
        'views', case when v.author_id = auth.uid() then (select count(*) from story_views sv where sv.story_id = v.id) end,
        'likes', case when v.author_id = auth.uid() then (select count(*) from story_likes sl where sl.story_id = v.id) end
      ) order by v.created_at) as items,
      max(v.created_at) as latest,
      bool_or(v.author_id <> auth.uid() and not exists (select 1 from story_views sv where sv.story_id = v.id and sv.viewer_id = auth.uid())) as unseen
    from vis v group by v.author_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('author', to_jsonb(p), 'stories', per.items, 'hasUnseen', coalesce(per.unseen, false), 'latestAt', per.latest)
    order by (per.author_id = auth.uid()) desc, coalesce(per.unseen, false) desc, per.latest desc), '[]'::jsonb)
  from per join profiles p on p.id = per.author_id;
$$;
revoke execute on function public.stories_tray() from public, anon;
grant execute on function public.stories_tray() to authenticated;

create or replace function public.story_viewers(p_story uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(jsonb_build_object('profile', to_jsonb(p), 'viewedAt', v.viewed_at,
      'liked', exists (select 1 from story_likes sl where sl.story_id = v.story_id and sl.user_id = v.viewer_id))
    order by exists (select 1 from story_likes sl where sl.story_id = v.story_id and sl.user_id = v.viewer_id) desc, v.viewed_at desc), '[]'::jsonb)
  from story_views v join profiles p on p.id = v.viewer_id join stories s on s.id = v.story_id
  where v.story_id = p_story and s.author_id = auth.uid();
$$;
revoke execute on function public.story_viewers(uuid) from public, anon;
grant execute on function public.story_viewers(uuid) to authenticated;

-- 2) ----------------------------------------------------------------- grupos no direct
alter table public.conversations add column if not exists is_group boolean not null default false;
alter table public.conversations add column if not exists title text check (title is null or char_length(title) between 1 and 60);
alter table public.conversations add column if not exists created_by uuid references public.profiles (id) on delete set null;
create index if not exists conversations_created_by_idx on public.conversations (created_by);

-- só dá para colocar no grupo quem tem alguma ligação com você (você segue ou te segue) — evita spam
create or replace function private.can_add_to_chat(p_me uuid, p_other uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select p_other <> p_me and exists (select 1 from profiles where id = p_other)
    and not private.is_blocked(p_me, p_other)
    and (coalesce(private.follow_status(p_me, p_other), '') = 'accepted' or coalesce(private.follow_status(p_other, p_me), '') = 'accepted');
$$;
revoke execute on function private.can_add_to_chat(uuid, uuid) from public, anon, authenticated;

create or replace function public.create_group_chat(p_title text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); cid uuid; m uuid; n int := 0;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if coalesce(trim(p_title), '') = '' or char_length(trim(p_title)) > 60 then raise exception 'invalid_title' using errcode = '22023'; end if;
  if coalesce(array_length(p_members, 1), 0) not between 1 and 30 then raise exception 'invalid_members' using errcode = '22023'; end if;
  if (select count(*) from conversations where created_by = uid and is_group and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into conversations (is_group, title, created_by) values (true, trim(p_title), uid) returning id into cid;
  insert into conversation_members (conversation_id, user_id, last_read_at) values (cid, uid, now());
  foreach m in array p_members loop
    continue when not private.can_add_to_chat(uid, m);
    insert into conversation_members (conversation_id, user_id) values (cid, m) on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  if n = 0 then raise exception 'invalid_members' using errcode = '22023'; end if;
  return cid;
end $$;
revoke execute on function public.create_group_chat(text, uuid[]) from public, anon;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;

create or replace function public.add_to_group_chat(p_conv uuid, p_members uuid[])
returns int language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); m uuid; n int := 0;
begin
  if not exists (select 1 from conversations c where c.id = p_conv and c.is_group) or not private.is_conversation_member(p_conv) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(array_length(p_members, 1), 0) > 30
     or (select count(*) from conversation_members where conversation_id = p_conv) + coalesce(array_length(p_members, 1), 0) > 50 then
    raise exception 'invalid_members' using errcode = '22023';
  end if;
  foreach m in array coalesce(p_members, '{}') loop
    continue when not private.can_add_to_chat(uid, m);
    insert into conversation_members (conversation_id, user_id) values (p_conv, m) on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.add_to_group_chat(uuid, uuid[]) from public, anon;
grant execute on function public.add_to_group_chat(uuid, uuid[]) to authenticated;

create or replace function public.leave_conversation(p_conv uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid();
begin
  if not exists (select 1 from conversations where id = p_conv and is_group) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from conversation_members where conversation_id = p_conv and user_id = uid;
  delete from conversations c where c.id = p_conv and not exists (select 1 from conversation_members m where m.conversation_id = c.id);
end $$;
revoke execute on function public.leave_conversation(uuid) from public, anon;
grant execute on function public.leave_conversation(uuid) to authenticated;

-- conversa 1:1 nunca reaproveita um grupo de 2 pessoas
create or replace function public.start_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  uid uuid := auth.uid();
  o profiles;
  cid uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_other = uid then raise exception 'invalid_target' using errcode = '22023'; end if;
  select * into o from profiles where id = p_other;
  if not found then raise exception 'not_found' using errcode = '22023'; end if;
  if private.is_blocked(uid, p_other) then raise exception 'blocked' using errcode = '42501'; end if;
  if o.is_private and coalesce(private.follow_status(uid, p_other), '') <> 'accepted'
     and coalesce(private.follow_status(p_other, uid), '') <> 'accepted' then
    raise exception 'dm_not_allowed' using errcode = '42501';
  end if;
  select a.conversation_id into cid
  from conversation_members a join conversation_members b on b.conversation_id = a.conversation_id
  join conversations c on c.id = a.conversation_id and not c.is_group
  where a.user_id = uid and b.user_id = p_other
  limit 1;
  if cid is null then
    insert into conversations default values returning id into cid;
    insert into conversation_members (conversation_id, user_id, last_read_at) values (cid, uid, now()), (cid, p_other, null);
  end if;
  return cid;
end $$;
revoke execute on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;

-- caixa de entrada com grupos (título, até 3 rostos, total) e rótulo de resposta de story
create or replace function public.inbox()
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t."lastAt" desc), '[]'::jsonb) from (
    select c.id as "id", c.last_message_at as "lastAt", c.is_group as "isGroup", c.title as "title",
      case when not c.is_group then (select to_jsonb(p) from conversation_members om join profiles p on p.id = om.user_id
        where om.conversation_id = c.id and om.user_id <> auth.uid() limit 1) end as "other",
      case when c.is_group then (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from (
        select p.* from conversation_members om join profiles p on p.id = om.user_id
        where om.conversation_id = c.id and om.user_id <> auth.uid() order by p.username limit 3) p) end as "members",
      (select count(*) from conversation_members om where om.conversation_id = c.id)::int as "memberCount",
      (select jsonb_build_object('body', m.body, 'senderId', m.sender_id, 'createdAt', m.created_at, 'replyLabel', m.reply_label,
          'senderName', (select username from profiles where id = m.sender_id))
        from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as "last",
      exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid()
              and m.created_at > coalesce(me.last_read_at, '-infinity')) as "unread",
      c.is_group or exists (select 1 from conversation_members om join follows f
                on f.follower_id = auth.uid() and f.followee_id = om.user_id and f.status = 'accepted'
              where om.conversation_id = c.id and om.user_id <> auth.uid()) as "iFollow",
      c.is_group or exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id = auth.uid()) as "replied"
    from conversation_members me join conversations c on c.id = me.conversation_id
    where me.user_id = auth.uid()
      and (c.is_group or exists (select 1 from messages m where m.conversation_id = c.id))
  ) t;
$$;
revoke execute on function public.inbox() from public, anon;
grant execute on function public.inbox() to authenticated;

-- cabeçalho do chat: 1:1 ou grupo
create or replace function public.conversation_info(p_conv uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object('id', c.id, 'isGroup', c.is_group, 'title', c.title, 'createdBy', c.created_by,
    'members', (select coalesce(jsonb_agg(to_jsonb(p) order by p.username), '[]'::jsonb)
                from conversation_members m join profiles p on p.id = m.user_id where m.conversation_id = c.id))
  from conversations c where c.id = p_conv and private.is_conversation_member(c.id);
$$;
revoke execute on function public.conversation_info(uuid) from public, anon;
grant execute on function public.conversation_info(uuid) to authenticated;
