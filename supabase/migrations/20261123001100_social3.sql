-- ============================================================================
-- FOMO · 0011 · Social 3
--  1) direct: caixa com filtro (quem eu sigo / solicitações de quem não sigo)
--  2) "quem tá indo": amigos que vão ao rolê (só o que o viewer já poderia ver)
--  3) lembrete 2 h antes para quem confirmou "vou"/"talvez" num grupo
--  4) enquete dentro do grupo
-- ============================================================================

-- 1) ----------------------------------------------------------------- inbox com filtro
create or replace function public.inbox()
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t."lastAt" desc), '[]'::jsonb) from (
    select c.id as "id", c.last_message_at as "lastAt",
      (select to_jsonb(p) from conversation_members om join profiles p on p.id = om.user_id
        where om.conversation_id = c.id and om.user_id <> auth.uid() limit 1) as "other",
      (select jsonb_build_object('body', m.body, 'senderId', m.sender_id, 'createdAt', m.created_at)
        from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as "last",
      exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid()
              and m.created_at > coalesce(me.last_read_at, '-infinity')) as "unread",
      exists (select 1 from conversation_members om join follows f
                on f.follower_id = auth.uid() and f.followee_id = om.user_id and f.status = 'accepted'
              where om.conversation_id = c.id and om.user_id <> auth.uid()) as "iFollow",
      exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id = auth.uid()) as "replied"
    from conversation_members me join conversations c on c.id = me.conversation_id
    where me.user_id = auth.uid()
      and exists (select 1 from messages m where m.conversation_id = c.id)
  ) t;
$$;
revoke execute on function public.inbox() from public, anon;
grant execute on function public.inbox() to authenticated;

-- 2) ----------------------------------------------------------------- quem tá indo
-- Pessoas que EU sigo e que vão ao rolê. Fontes (sem vazar nada):
--   a) presença declarada cuja visibilidade já me deixa ver (mesma regra do check-in);
--   b) "vou" num grupo do qual EU também faço parte.
create or replace function public.event_friends(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(to_jsonb(p) order by p.username), '[]'::jsonb)
  from profiles p
  where p.id <> auth.uid()
    and exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted')
    and not private.is_blocked(auth.uid(), p.id)
    and (
      exists (select 1 from check_ins ci where ci.user_id = p.id and ci.event_id = p_event_id
              and private.can_view_item(auth.uid(), ci.user_id, ci.visibility))
      or exists (select 1 from group_members gm join groups g on g.id = gm.group_id
                 where g.event_id = p_event_id and gm.user_id = p.id and gm.status = 'going'
                   and private.is_group_member(g.id))
    );
$$;
revoke execute on function public.event_friends(uuid) from public, anon;
grant execute on function public.event_friends(uuid) to authenticated;

-- 3) ----------------------------------------------------------------- lembrete
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'like', 'comment', 'achievement', 'event_approved', 'moderation',
  'message', 'group_invite', 'group_response', 'event_reminder', 'group_poll'));

-- roda a cada 15 min; avisa uma única vez por grupo quem confirmou, quando faltam até 2 h
create or replace function public.send_event_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into notifications (user_id, type, actor_id, entity_type, entity_id)
  select gm.user_id, 'event_reminder', null, 'group', g.id
  from group_members gm join groups g on g.id = gm.group_id join events e on e.id = g.event_id
  where gm.status in ('going', 'maybe') and e.status = 'approved'
    and e.starts_at > now() and e.starts_at <= now() + interval '2 hours'
    and not exists (select 1 from notifications n where n.user_id = gm.user_id and n.type = 'event_reminder' and n.entity_id = g.id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.send_event_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'fomo_event_reminders') then
      perform cron.unschedule('fomo_event_reminders');
    end if;
    perform cron.schedule('fomo_event_reminders', '*/15 * * * *', 'select public.send_event_reminders();');
  end if;
end $$;

-- 4) ----------------------------------------------------------------- enquete no grupo
create table if not exists public.group_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(question) between 2 and 120),
  options text[] not null check (array_length(options, 1) between 2 and 4),
  created_at timestamptz not null default now()
);
create index if not exists group_polls_group_idx on public.group_polls (group_id, created_at desc);
create index if not exists group_polls_creator_idx on public.group_polls (created_by);
create table if not exists public.group_poll_votes (
  poll_id uuid not null references public.group_polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  option smallint not null check (option between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
create index if not exists group_poll_votes_user_idx on public.group_poll_votes (user_id);

alter table public.group_polls enable row level security;
alter table public.group_poll_votes enable row level security;
create policy group_polls_member on public.group_polls for select to authenticated using (private.is_group_member(group_id));
create policy group_poll_votes_member on public.group_poll_votes for select to authenticated
  using (exists (select 1 from group_polls p where p.id = poll_id and private.is_group_member(p.group_id)));
revoke insert, update, delete on public.group_polls, public.group_poll_votes from anon, authenticated;

create or replace function public.create_poll(p_group uuid, p_question text, p_options text[])
returns uuid language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); pid uuid; opts text[];
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from group_members where group_id = p_group and user_id = uid and status in ('going', 'maybe')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select array_agg(o) into opts from (select left(trim(x), 60) o from unnest(p_options) x where trim(x) <> '') s;
  if coalesce(array_length(opts, 1), 0) not between 2 and 4 then raise exception 'invalid_poll' using errcode = '22023'; end if;
  if (select count(*) from group_polls where group_id = p_group) >= 10 then raise exception 'rate_limited' using errcode = '54000'; end if;
  insert into group_polls (group_id, created_by, question, options) values (p_group, uid, trim(p_question), opts) returning id into pid;
  insert into notifications (user_id, type, actor_id, entity_type, entity_id)
  select gm.user_id, 'group_poll', uid, 'group', p_group from group_members gm
  where gm.group_id = p_group and gm.user_id <> uid and gm.status <> 'declined';
  return pid;
end $$;
revoke execute on function public.create_poll(uuid, text, text[]) from public, anon;
grant execute on function public.create_poll(uuid, text, text[]) to authenticated;

create or replace function public.vote_poll(p_poll uuid, p_option smallint)
returns void language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); p group_polls;
begin
  select * into p from group_polls where id = p_poll;
  if not found or not private.is_group_member(p.group_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_option < 0 or p_option >= array_length(p.options, 1) then raise exception 'invalid_option' using errcode = '22023'; end if;
  insert into group_poll_votes (poll_id, user_id, option) values (p_poll, uid, p_option)
  on conflict (poll_id, user_id) do update set option = excluded.option, created_at = now();
end $$;
revoke execute on function public.vote_poll(uuid, smallint) from public, anon;
grant execute on function public.vote_poll(uuid, smallint) to authenticated;

-- detalhe do grupo agora traz as enquetes (com votos por opção e o meu voto)
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
      from group_members m join profiles p on p.id = m.user_id where m.group_id = g.id),
    'polls', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', pl.id, 'question', pl.question, 'options', to_jsonb(pl.options), 'createdBy', pl.created_by, 'createdAt', pl.created_at,
        'votes', (select to_jsonb(array_agg((select count(*) from group_poll_votes v where v.poll_id = pl.id and v.option = i - 1) order by i))
                  from generate_series(1, array_length(pl.options, 1)) i),
        'myVote', (select v.option from group_poll_votes v where v.poll_id = pl.id and v.user_id = auth.uid())
      ) order by pl.created_at desc), '[]'::jsonb)
      from group_polls pl where pl.group_id = g.id)
  )
  from groups g join events e on e.id = g.event_id
  where g.id = p_group and private.is_group_member(g.id);
$$;
revoke execute on function public.group_json(uuid) from public, anon;
grant execute on function public.group_json(uuid) to authenticated;
