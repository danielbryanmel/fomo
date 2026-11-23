-- ============================================================================
-- FOMO · 0012 · Social 4 — segurança no check-in, stories, sugestões, "cheguei bem"
--  1) check-in seguro: público / amigos (seguem um ao outro) / só eu (anônimo) e
--     "mostrar só depois" (reveal_at). A presença SEMPRE conta no rolê, mas só
--     como número agregado (e só a partir de 3 pessoas, para não identificar ninguém).
--  2) stories de 24 h (foto, opcionalmente câmera dupla), com quem viu
--  3) sugestões de amizade (sem vazar presença escondida)
--  4) "cheguei bem": avisa o grupo que você chegou em casa
-- ============================================================================

-- 1) ----------------------------------------------------------------- check-in seguro
alter table public.check_ins drop constraint if exists check_ins_visibility_check;
alter table public.check_ins add constraint check_ins_visibility_check
  check (visibility in ('public', 'followers', 'friends', 'private'));
alter table public.check_ins add column if not exists reveal_at timestamptz;

alter table public.profiles drop constraint if exists profiles_default_checkin_visibility_check;
alter table public.profiles add constraint profiles_default_checkin_visibility_check
  check (default_checkin_visibility in ('public', 'followers', 'friends', 'private'));

-- "amigos" = um segue o outro (os dois aceitos)
create or replace function private.can_view_item(viewer uuid, owner uuid, visibility text)
returns boolean language sql stable security definer set search_path = public, private as $$
  select case
    when viewer is not null and viewer = owner then true
    when viewer is not null and is_blocked(viewer, owner) then false
    when visibility = 'private' then false
    when visibility = 'followers' then viewer is not null and follow_status(viewer, owner) = 'accepted'
    when visibility = 'friends' then viewer is not null and follow_status(viewer, owner) = 'accepted'
                                     and follow_status(owner, viewer) = 'accepted'
    else can_view_profile_content(viewer, owner)
  end;
$$;

-- presença escondida até reveal_at (o dono sempre vê a própria)
drop policy if exists check_ins_select on public.check_ins;
create policy check_ins_select on public.check_ins for select to anon, authenticated
  using (user_id = (select auth.uid())
         or (private.can_view_item((select auth.uid()), user_id, visibility)
             and (reveal_at is null or reveal_at <= now())));
revoke update on public.check_ins from anon, authenticated;
grant update (visibility, reveal_at) on public.check_ins to authenticated;

-- número agregado de presença + o meu check-in. Abaixo de 3 pessoas não mostra o número.
create or replace function public.event_presence(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'count', case when n >= 3 then n else null end,
    'few', n > 0 and n < 3,
    'me', (select jsonb_build_object('visibility', ci.visibility, 'revealAt', ci.reveal_at, 'status', ci.status, 'createdAt', ci.created_at)
           from check_ins ci where ci.event_id = p_event_id and ci.user_id = auth.uid())
  )
  from (select count(*)::int n from check_ins where event_id = p_event_id) c;
$$;
revoke execute on function public.event_presence(uuid) from public;
grant execute on function public.event_presence(uuid) to anon, authenticated;

create or replace function public.check_in(p_event_id uuid, p_visibility text, p_reveal_minutes int default 0)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); e events;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = uid) then raise exception 'profile_required' using errcode = '42501'; end if;
  if p_visibility not in ('public', 'friends', 'followers', 'private') then raise exception 'invalid_visibility' using errcode = '22023'; end if;
  if coalesce(p_reveal_minutes, 0) not between 0 and 1440 then raise exception 'invalid_reveal' using errcode = '22023'; end if;
  select * into e from events where id = p_event_id and status in ('approved', 'ended');
  if not found then raise exception 'event_not_available' using errcode = '22023'; end if;
  -- só perto do horário: de 3 h antes até 2 h depois do fim
  if now() < e.starts_at - interval '3 hours'
     or now() > coalesce(e.ends_at, e.starts_at + interval '10 hours') + interval '2 hours' then
    raise exception 'checkin_closed' using errcode = '22023';
  end if;
  if (select count(*) from check_ins where user_id = uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into check_ins (user_id, event_id, status, visibility, reveal_at)
  values (uid, p_event_id, 'declared', p_visibility,
          case when coalesce(p_reveal_minutes, 0) > 0 then now() + make_interval(mins => p_reveal_minutes) end)
  on conflict (user_id, event_id) where event_id is not null
  do update set visibility = excluded.visibility, reveal_at = excluded.reveal_at;
  return public.event_presence(p_event_id);
end $$;
revoke execute on function public.check_in(uuid, text, int) from public, anon;
grant execute on function public.check_in(uuid, text, int) to authenticated;

-- "quem tá indo" passa a respeitar o "mostrar só depois"
create or replace function public.event_friends(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(to_jsonb(p) order by p.username), '[]'::jsonb)
  from profiles p
  where p.id <> auth.uid()
    and exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted')
    and not private.is_blocked(auth.uid(), p.id)
    and (
      exists (select 1 from check_ins ci where ci.user_id = p.id and ci.event_id = p_event_id
              and private.can_view_item(auth.uid(), ci.user_id, ci.visibility)
              and (ci.reveal_at is null or ci.reveal_at <= now()))
      or exists (select 1 from group_members gm join groups g on g.id = gm.group_id
                 where g.event_id = p_event_id and gm.user_id = p.id and gm.status = 'going'
                   and private.is_group_member(g.id))
    );
$$;
revoke execute on function public.event_friends(uuid) from public, anon;
grant execute on function public.event_friends(uuid) to authenticated;

-- 2) ----------------------------------------------------------------- stories 24 h
create table if not exists public.stories (
  id uuid primary key,
  author_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  width int,
  height int,
  event_id uuid references public.events (id) on delete set null,
  caption text check (caption is null or char_length(caption) <= 140),
  visibility text not null default 'followers' check (visibility in ('public', 'followers', 'friends')),
  is_dual boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists stories_author_idx on public.stories (author_id, expires_at desc);
create index if not exists stories_event_idx on public.stories (event_id) where event_id is not null;
create table if not exists public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create index if not exists story_views_viewer_idx on public.story_views (viewer_id);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

create or replace function private.can_view_story(p_author uuid, p_visibility text, p_expires timestamptz)
returns boolean language sql stable security definer set search_path = public, private as $$
  -- coalesce: can_view_item devolve NULL para quem não segue; aqui NULL precisa virar "não"
  select coalesce(p_author = auth.uid() or (p_expires > now() and private.can_view_item(auth.uid(), p_author, p_visibility)), false);
$$;
revoke execute on function private.can_view_story(uuid, text, timestamptz) from public;
grant execute on function private.can_view_story(uuid, text, timestamptz) to anon, authenticated;

create policy stories_select on public.stories for select to authenticated
  using (private.can_view_story(author_id, visibility, expires_at));
create policy stories_delete on public.stories for delete to authenticated using (author_id = (select auth.uid()));
create policy story_views_select on public.story_views for select to authenticated
  using (viewer_id = (select auth.uid())
         or exists (select 1 from stories s where s.id = story_id and s.author_id = (select auth.uid())));
revoke insert, update, delete on public.stories, public.story_views from anon, authenticated;
grant delete on public.stories to authenticated;

-- a foto do story fica no bucket privado, lida com a mesma regra do story
create policy story_media_read on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and exists (
    select 1 from public.stories s where s.storage_path = storage.objects.name
      and private.can_view_story(s.author_id, s.visibility, s.expires_at)));

create or replace function public.create_story(p_id uuid, p_path text, p_width int, p_height int,
  p_event_id uuid default null, p_caption text default null, p_visibility text default 'followers', p_dual boolean default false)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = uid) then raise exception 'profile_required' using errcode = '42501'; end if;
  if p_path !~ ('^' || uid::text || '/stories/' || p_id::text || '\.(jpg|jpeg)$') then
    raise exception 'invalid_media_path' using errcode = '42501';
  end if;
  if p_visibility not in ('public', 'followers', 'friends') then raise exception 'invalid_visibility' using errcode = '22023'; end if;
  if p_event_id is not null and not exists (select 1 from events where id = p_event_id and status in ('approved', 'ended')) then
    raise exception 'event_not_available' using errcode = '22023';
  end if;
  if (select count(*) from stories where author_id = uid and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into stories (id, author_id, storage_path, width, height, event_id, caption, visibility, is_dual)
  values (p_id, uid, p_path, p_width, p_height, p_event_id, nullif(trim(p_caption), ''), p_visibility, coalesce(p_dual, false));
  return p_id;
end $$;
revoke execute on function public.create_story(uuid, text, int, int, uuid, text, text, boolean) from public, anon;
grant execute on function public.create_story(uuid, text, int, int, uuid, text, text, boolean) to authenticated;

create or replace function public.view_story(p_story uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare s stories;
begin
  select * into s from stories where id = p_story;
  if not found or not private.can_view_story(s.author_id, s.visibility, s.expires_at) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if s.author_id <> auth.uid() then
    insert into story_views (story_id, viewer_id) values (p_story, auth.uid()) on conflict do nothing;
  end if;
end $$;
revoke execute on function public.view_story(uuid) from public, anon;
grant execute on function public.view_story(uuid) to authenticated;

-- bandeja: eu primeiro, depois quem eu sigo com stories ativos (não vistos antes)
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
        'views', case when v.author_id = auth.uid() then (select count(*) from story_views sv where sv.story_id = v.id) end
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
  select coalesce(jsonb_agg(jsonb_build_object('profile', to_jsonb(p), 'viewedAt', v.viewed_at) order by v.viewed_at desc), '[]'::jsonb)
  from story_views v join profiles p on p.id = v.viewer_id join stories s on s.id = v.story_id
  where v.story_id = p_story and s.author_id = auth.uid();
$$;
revoke execute on function public.story_viewers(uuid) from public, anon;
grant execute on function public.story_viewers(uuid) to authenticated;

-- linhas de stories vencidos há mais de 7 dias saem do banco (a foto já fica ilegível ao vencer)
create or replace function public.purge_stories()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from stories where expires_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_stories() from public, anon, authenticated;

-- 3) ----------------------------------------------------------------- sugestões de amizade
create or replace function public.suggested_people(p_limit int default 20)
returns jsonb language sql stable security definer set search_path = public, private as $$
  with me as (select auth.uid() id),
  cand as (
    select p.*,
      (select count(*) from follows a join follows b on b.follower_id = a.followee_id
        where a.follower_id = (select id from me) and a.status = 'accepted'
          and b.followee_id = p.id and b.status = 'accepted')::int as mutuals,
      exists (select 1 from follows f where f.follower_id = p.id and f.followee_id = (select id from me) and f.status = 'accepted') as follows_me,
      (select count(distinct a.event_id) from check_ins a join check_ins b on b.event_id = a.event_id
        where a.user_id = (select id from me) and b.user_id = p.id
          and private.can_view_item((select id from me), b.user_id, b.visibility)
          and (b.reveal_at is null or b.reveal_at <= now()))::int as same_events,
      exists (select 1 from group_members a join group_members b on b.group_id = a.group_id
        where a.user_id = (select id from me) and b.user_id = p.id) as same_group
    from profiles p
    where p.id <> (select id from me) and not p.is_demo
      and not exists (select 1 from follows f where f.follower_id = (select id from me) and f.followee_id = p.id)
      and not private.is_blocked((select id from me), p.id)
  )
  select coalesce(jsonb_agg(jsonb_build_object('profile', to_jsonb(c) - 'mutuals' - 'follows_me' - 'same_events' - 'same_group', 'reason',
      case when c.follows_me then 'Segue você'
           when c.same_group then 'Esteve num grupo com você'
           when c.mutuals > 0 then c.mutuals || case when c.mutuals = 1 then ' amigo em comum' else ' amigos em comum' end
           when c.same_events > 0 then 'Foi nos mesmos rolês'
           else 'Em alta no FOMO' end)
    order by (c.follows_me::int * 5 + c.same_group::int * 4 + c.mutuals * 3 + c.same_events * 2) desc, c.followers_count desc), '[]'::jsonb)
  from (select * from cand order by (follows_me::int * 5 + same_group::int * 4 + mutuals * 3 + same_events * 2) desc, followers_count desc
        limit least(greatest(coalesce(p_limit, 20), 1), 50)) c;
$$;
revoke execute on function public.suggested_people(int) from public, anon;
grant execute on function public.suggested_people(int) to authenticated;

-- 4) ----------------------------------------------------------------- cheguei bem
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'like', 'comment', 'achievement', 'event_approved', 'moderation',
  'message', 'group_invite', 'group_response', 'event_reminder', 'group_poll', 'arrived_home'));

create or replace function public.arrived_home(p_group uuid)
returns int language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); n int;
begin
  if not exists (select 1 from group_members where group_id = p_group and user_id = uid and status in ('going', 'maybe')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from notifications where actor_id = uid and type = 'arrived_home' and entity_id = p_group
             and created_at > now() - interval '6 hours') then
    return 0; -- já avisou
  end if;
  insert into notifications (user_id, type, actor_id, entity_type, entity_id)
  select gm.user_id, 'arrived_home', uid, 'group', p_group from group_members gm
  where gm.group_id = p_group and gm.user_id <> uid and gm.status in ('going', 'maybe');
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.arrived_home(uuid) from public, anon;
grant execute on function public.arrived_home(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'fomo_purge_stories') then
      perform cron.unschedule('fomo_purge_stories');
    end if;
    perform cron.schedule('fomo_purge_stories', '41 5 * * *', 'select public.purge_stories();');
  end if;
end $$;
