-- ============================================================================
-- FOMO · 0010 · Social 2
--  1) nota com meia estrela (0,5 a 5)
--  2) trocar o @ (1 troca grátis; as seguintes ficam bloqueadas até existir pagamento)
--  3) rolês que se repetem (série semanal aprovada de uma vez)
--  4) mensagens diretas (1:1), com RLS por participante
--  5) grupos ligados a um rolê, com convites: vou / talvez / não vou
-- ============================================================================

-- 1) ----------------------------------------------------------------- meia estrela
alter table public.posts drop constraint if exists posts_rating_check;
alter table public.posts alter column rating type numeric(2,1);
alter table public.posts add constraint posts_rating_check
  check (rating is null or (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)));
alter table public.reviews drop constraint if exists reviews_rating_check;
alter table public.reviews alter column rating type numeric(2,1);
alter table public.reviews add constraint reviews_rating_check
  check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2));

drop function if exists public.create_post(uuid, text, jsonb, uuid, text, date, uuid, smallint, text, boolean);
create or replace function public.create_post(
  p_post_id uuid,
  p_body text,
  p_media jsonb,              -- [{ "path": "...", "width": 1080, "height": 1350 }]
  p_event_id uuid default null,
  p_place_name text default null,
  p_experience_date date default null,
  p_category_id uuid default null,
  p_rating numeric default null,
  p_visibility text default 'public',
  p_declare_presence boolean default false
)
returns public.posts language plpgsql security definer set search_path = public, private as $$
declare
  uid uuid := auth.uid();
  ci uuid;
  result posts;
  m jsonb;
  i int := 0;
  n int := coalesce(jsonb_array_length(p_media), 0);
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = uid) then raise exception 'profile_required' using errcode = '42501'; end if;
  if n > 10 then raise exception 'too_many_media' using errcode = '22023'; end if;
  if p_rating is not null and (p_rating < 0.5 or p_rating > 5 or p_rating * 2 <> trunc(p_rating * 2)) then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;
  if p_visibility not in ('public', 'followers', 'private') then raise exception 'invalid_visibility' using errcode = '22023'; end if;

  -- rate limit simples: 20 posts / 24 h
  if (select count(*) from posts where author_id = uid and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  -- presença DECLARADA (nunca verificada por aqui)
  if p_declare_presence then
    insert into check_ins (user_id, event_id, status, visibility)
    values (uid, p_event_id, 'declared', (select default_checkin_visibility from profiles where id = uid))
    on conflict (user_id, event_id) where event_id is not null do update set created_at = check_ins.created_at
    returning id into ci;
  end if;

  insert into posts (id, author_id, body, event_id, place_name, experience_date, category_id, rating, check_in_id, visibility, media_count)
  values (p_post_id, uid, nullif(trim(p_body), ''), p_event_id, nullif(trim(p_place_name), ''), p_experience_date, p_category_id, p_rating, ci, p_visibility, n)
  returning * into result;

  for m in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    -- o arquivo precisa estar na pasta do próprio autor e do próprio post
    if (m->>'path') !~ ('^' || uid::text || '/' || p_post_id::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$') then
      raise exception 'invalid_media_path' using errcode = '42501';
    end if;
    insert into post_media (post_id, storage_path, width, height, position)
    values (p_post_id, m->>'path', nullif(m->>'width', '')::int, nullif(m->>'height', '')::int, i);
    i := i + 1;
  end loop;

  -- XP: só para conteúdo com substância (foto OU texto >= 40 caracteres), com limite diário
  if n > 0 or char_length(coalesce(p_body, '')) >= 40 then
    perform award_xp(uid, case when n > 0 then 'post_with_photo' else 'post_text' end, 'post', p_post_id);
  end if;

  return result;
end $$;
revoke execute on function public.create_post(uuid, text, jsonb, uuid, text, date, uuid, numeric, text, boolean) from public, anon;
grant execute on function public.create_post(uuid, text, jsonb, uuid, text, date, uuid, numeric, text, boolean) to authenticated;

-- 2) ----------------------------------------------------------------- trocar o @
alter table public.profiles add column if not exists username_changes int not null default 0;

create or replace function public.change_username(p_username text)
returns public.profiles language plpgsql security definer set search_path = public, private as $$
declare
  uid uuid := auth.uid();
  u text := lower(trim(p_username));
  me profiles;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into me from profiles where id = uid;
  if not found then raise exception 'profile_required' using errcode = '42501'; end if;
  if u = me.username then return me; end if;
  if u !~ '^[a-z0-9_.]{3,30}$' then raise exception 'invalid_username' using errcode = '22023'; end if;
  if u in ('admin', 'fomo', 'suporte', 'moderacao', 'oficial') then raise exception 'reserved_username' using errcode = '22023'; end if;
  if exists (select 1 from profiles where lower(username) = u and id <> uid) then raise exception 'username_taken' using errcode = '23505'; end if;
  -- 1 troca grátis; depois, só com pagamento (ainda não disponível no beta)
  if me.username_changes >= 1 then raise exception 'username_change_paid' using errcode = '42501'; end if;
  update profiles set username = u, username_changes = username_changes + 1 where id = uid returning * into me;
  return me;
end $$;
revoke execute on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

-- 3) ----------------------------------------------------------------- recorrência
alter table public.events add column if not exists series_id uuid;
create index if not exists events_series_idx on public.events (series_id) where series_id is not null;

-- limite diário conta SÉRIES (uma série de 8 semanas = 1 sugestão)
create or replace function public.events_submit_guard()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is not null and not private.is_moderator() then
    if (select count(distinct coalesce(series_id, id)) from events
        where created_by = auth.uid() and created_at > now() - interval '24 hours'
          and coalesce(series_id, id) is distinct from coalesce(new.series_id, new.id)) >= 5 then
      raise exception 'rate_limited' using errcode = '54000';
    end if;
    if new.series_id is not null and (select count(*) from events where series_id = new.series_id) >= 12 then
      raise exception 'series_too_long' using errcode = '22023';
    end if;
    if new.starts_at < now() - interval '6 hours' then
      raise exception 'event_in_past' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.events_submit_guard() from public, anon, authenticated;

-- aprovar/recusar um rolê de uma série vale para a série inteira (só os pendentes)
create or replace function public.moderate_event(p_event_id uuid, p_approve boolean)
returns public.events language plpgsql security definer set search_path = public, private as $$
declare e events;
begin
  if not private.is_moderator() then raise exception 'forbidden' using errcode = '42501'; end if;
  update events set status = case when p_approve then 'approved' else 'cancelled' end,
                    moderated_by = auth.uid(), moderated_at = now()
  where id = p_event_id and status = 'pending'
  returning * into e;
  if not found then raise exception 'not_pending' using errcode = '22023'; end if;
  if e.series_id is not null then
    update events set status = e.status, moderated_by = auth.uid(), moderated_at = now()
    where series_id = e.series_id and status = 'pending';
  end if;
  if p_approve then
    perform award_xp(e.created_by, 'event_approved', 'event', e.id);
    insert into notifications (user_id, type, actor_id, entity_type, entity_id)
    values (e.created_by, 'event_approved', auth.uid(), 'event', e.id);
  else
    insert into notifications (user_id, type, actor_id, entity_type, entity_id)
    values (e.created_by, 'moderation', auth.uid(), 'event', e.id);
  end if;
  return e;
end $$;
revoke execute on function public.moderate_event(uuid, boolean) from public, anon;
grant execute on function public.moderate_event(uuid, boolean) to authenticated;

-- notificações novas
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'like', 'comment', 'achievement', 'event_approved', 'moderation',
  'message', 'group_invite', 'group_response'));

-- 4) ----------------------------------------------------------------- mensagens diretas
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function private.is_conversation_member(p_conv uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from conversation_members where conversation_id = p_conv and user_id = auth.uid());
$$;
revoke execute on function private.is_conversation_member(uuid) from public;
grant execute on function private.is_conversation_member(uuid) to authenticated;

create policy conversations_member on public.conversations for select to authenticated
  using (private.is_conversation_member(id));
create policy conversation_members_select on public.conversation_members for select to authenticated
  using (private.is_conversation_member(conversation_id));
create policy conversation_members_read on public.conversation_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_select on public.messages for select to authenticated
  using (private.is_conversation_member(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid()) and private.is_conversation_member(conversation_id)
    and not exists (select 1 from conversation_members m where m.conversation_id = messages.conversation_id
                    and m.user_id <> (select auth.uid()) and private.is_blocked((select auth.uid()), m.user_id))
  );

revoke insert, update, delete on public.conversations, public.conversation_members, public.messages from anon, authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

-- abre (ou reaproveita) a conversa 1:1. Perfil privado: só se um segue o outro.
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
  where a.user_id = uid and b.user_id = p_other
    and (select count(*) from conversation_members c where c.conversation_id = a.conversation_id) = 2
  limit 1;
  if cid is null then
    insert into conversations default values returning id into cid;
    insert into conversation_members (conversation_id, user_id, last_read_at) values (cid, uid, now()), (cid, p_other, null);
  end if;
  return cid;
end $$;
revoke execute on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  update conversation_members set last_read_at = new.created_at where conversation_id = new.conversation_id and user_id = new.sender_id;
  -- uma notificação não lida por conversa (sem spam a cada mensagem)
  insert into notifications (user_id, type, actor_id, entity_type, entity_id)
  select m.user_id, 'message', new.sender_id, 'conversation', new.conversation_id
  from conversation_members m
  where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id
    and not exists (select 1 from notifications n where n.user_id = m.user_id and n.type = 'message'
                    and n.entity_id = new.conversation_id and n.read_at is null);
  return null;
end $$;
revoke execute on function public.messages_after_insert() from public, anon, authenticated;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages for each row execute function public.messages_after_insert();

-- caixa de entrada: outra pessoa, última mensagem e se há não lidas
create or replace function public.inbox()
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t."lastAt" desc), '[]'::jsonb) from (
    select c.id as "id", c.last_message_at as "lastAt",
      (select to_jsonb(p) from conversation_members om join profiles p on p.id = om.user_id
        where om.conversation_id = c.id and om.user_id <> auth.uid() limit 1) as "other",
      (select jsonb_build_object('body', m.body, 'senderId', m.sender_id, 'createdAt', m.created_at)
        from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as "last",
      exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid()
              and m.created_at > coalesce(me.last_read_at, '-infinity')) as "unread"
    from conversation_members me join conversations c on c.id = me.conversation_id
    where me.user_id = auth.uid()
      and exists (select 1 from messages m where m.conversation_id = c.id)
  ) t;
$$;
revoke execute on function public.inbox() from public, anon;
grant execute on function public.inbox() to authenticated;

-- 5) ----------------------------------------------------------------- grupos e convites
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  created_at timestamptz not null default now()
);
create index if not exists groups_event_idx on public.groups (event_id);
create index if not exists groups_owner_idx on public.groups (owner_id);
create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'going', 'maybe', 'declined')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);
create index if not exists group_members_inviter_idx on public.group_members (invited_by);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create or replace function private.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid());
$$;
revoke execute on function private.is_group_member(uuid) from public;
grant execute on function private.is_group_member(uuid) to authenticated;

create policy groups_member on public.groups for select to authenticated using (private.is_group_member(id));
create policy group_members_select on public.group_members for select to authenticated using (private.is_group_member(group_id));
create policy group_members_leave on public.group_members for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from groups g where g.id = group_id and g.owner_id = (select auth.uid())));
revoke insert, update, delete on public.groups, public.group_members from anon, authenticated;
grant delete on public.group_members to authenticated;
grant delete on public.groups to authenticated;
create policy groups_owner_delete on public.groups for delete to authenticated using (owner_id = (select auth.uid()));

create or replace function private.invite_many(p_group uuid, p_invitees uuid[], p_by uuid)
returns int language plpgsql security definer set search_path = public, private as $$
declare v uuid; n int := 0;
begin
  foreach v in array coalesce(p_invitees, '{}') loop
    continue when v = p_by or private.is_blocked(p_by, v) or not exists (select 1 from profiles where id = v);
    insert into group_members (group_id, user_id, status, invited_by) values (p_group, v, 'invited', p_by)
    on conflict do nothing;
    if found then
      n := n + 1;
      insert into notifications (user_id, type, actor_id, entity_type, entity_id) values (v, 'group_invite', p_by, 'group', p_group);
    end if;
  end loop;
  return n;
end $$;
revoke execute on function private.invite_many(uuid, uuid[], uuid) from public, anon, authenticated;

create or replace function public.create_group(p_event_id uuid, p_name text, p_invitees uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); gid uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from events where id = p_event_id and status = 'approved') then raise exception 'event_not_available' using errcode = '22023'; end if;
  if coalesce(array_length(p_invitees, 1), 0) > 30 then raise exception 'too_many_invites' using errcode = '22023'; end if;
  if (select count(*) from groups where owner_id = uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into groups (event_id, owner_id, name) values (p_event_id, uid, trim(p_name)) returning id into gid;
  insert into group_members (group_id, user_id, status, responded_at) values (gid, uid, 'going', now());
  perform private.invite_many(gid, p_invitees, uid);
  return gid;
end $$;
revoke execute on function public.create_group(uuid, text, uuid[]) from public, anon;
grant execute on function public.create_group(uuid, text, uuid[]) to authenticated;

-- quem já confirmou ("vou") pode chamar mais gente
create or replace function public.invite_to_group(p_group uuid, p_invitees uuid[])
returns int language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid();
begin
  if not exists (select 1 from group_members where group_id = p_group and user_id = uid and status = 'going') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(array_length(p_invitees, 1), 0) > 30 then raise exception 'too_many_invites' using errcode = '22023'; end if;
  return private.invite_many(p_group, p_invitees, uid);
end $$;
revoke execute on function public.invite_to_group(uuid, uuid[]) from public, anon;
grant execute on function public.invite_to_group(uuid, uuid[]) to authenticated;

create or replace function public.respond_group(p_group uuid, p_status text)
returns void language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); g groups;
begin
  if p_status not in ('going', 'maybe', 'declined') then raise exception 'invalid_status' using errcode = '22023'; end if;
  update group_members set status = p_status, responded_at = now() where group_id = p_group and user_id = uid;
  if not found then raise exception 'not_invited' using errcode = '42501'; end if;
  select * into g from groups where id = p_group;
  if g.owner_id <> uid then
    insert into notifications (user_id, type, actor_id, entity_type, entity_id) values (g.owner_id, 'group_response', uid, 'group', p_group);
  end if;
end $$;
revoke execute on function public.respond_group(uuid, text) from public, anon;
grant execute on function public.respond_group(uuid, text) to authenticated;

-- meus grupos / detalhe do grupo, já montados para a tela
create or replace function public.group_json(p_group uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'id', g.id, 'name', g.name, 'ownerId', g.owner_id, 'createdAt', g.created_at,
    'event', jsonb_build_object('id', e.id, 'title', e.title, 'venueName', e.venue_name, 'startsAt', e.starts_at, 'endsAt', e.ends_at),
    'myStatus', (select status from group_members where group_id = g.id and user_id = auth.uid()),
    'counts', (select jsonb_build_object(
        'going', count(*) filter (where status = 'going'), 'maybe', count(*) filter (where status = 'maybe'),
        'invited', count(*) filter (where status = 'invited'), 'declined', count(*) filter (where status = 'declined'))
      from group_members where group_id = g.id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('status', m.status, 'profile', to_jsonb(p))
        order by case m.status when 'going' then 0 when 'maybe' then 1 when 'invited' then 2 else 3 end, p.username), '[]'::jsonb)
      from group_members m join profiles p on p.id = m.user_id where m.group_id = g.id)
  )
  from groups g join events e on e.id = g.event_id
  where g.id = p_group and private.is_group_member(g.id);
$$;
revoke execute on function public.group_json(uuid) from public, anon;
grant execute on function public.group_json(uuid) to authenticated;

create or replace function public.my_groups()
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(public.group_json(g.id) order by e.starts_at), '[]'::jsonb)
  from group_members m join groups g on g.id = m.group_id join events e on e.id = g.event_id
  where m.user_id = auth.uid() and m.status <> 'declined'
    and coalesce(e.ends_at, e.starts_at + interval '8 hours') > now() - interval '12 hours';
$$;
revoke execute on function public.my_groups() from public, anon;
grant execute on function public.my_groups() to authenticated;

-- realtime para o chat
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;
