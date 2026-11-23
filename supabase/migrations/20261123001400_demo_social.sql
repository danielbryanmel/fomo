-- ============================================================================
-- FOMO · 0014 · Demo social: a renovação do conteúdo de demonstração passa a
-- cobrir stories (24 h), check-ins, localização do grupo e conversas.
-- Os DADOS ficam em supabase/demo_social.sql (rodar 1x; remover: select public.demo_purge();).
-- ============================================================================
create or replace function public.demo_refresh()
returns void language plpgsql security definer set search_path = public as $$
declare
  t0 timestamptz := date_trunc('hour', now());
  day0 timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  e record;
  u uuid[];
  n int;
  i int;
  k int;
  lvl int;
  vibes text[] := array['ok', 'bom', 'bombando'];
  queues text[] := array['sem_fila', 'curta', 'media', 'longa'];
begin
  update events set status = 'approved', starts_at = t0 - interval '3 hours', ends_at = t0 + interval '5 hours'
  where is_demo and demo_schedule = 'live';
  update events set status = 'approved',
    starts_at = day0 + make_interval(days => split_part(substr(demo_schedule, 3), '@', 1)::int,
                                     hours => split_part(demo_schedule, '@', 2)::int),
    ends_at = null
  where is_demo and demo_schedule like 'd+%@%';

  update posts set created_at = now() - make_interval(mins => demo_age_min), updated_at = now() - make_interval(mins => demo_age_min)
  where is_demo and demo_age_min is not null;

  delete from live_reports where event_id in (select id from events where is_demo);
  select array_agg(id order by id) into u from profiles where is_demo;
  if u is null then return; end if;
  for e in select id, demo_crowd from events where is_demo and demo_schedule = 'live' and demo_crowd is not null loop
    -- histórico: 3 horas atrás → agora, lotação subindo até o nível atual
    for k in 0..2 loop
      lvl := greatest(1, e.demo_crowd - (3 - k) + 1);
      insert into live_reports (user_id, event_id, crowd, vibe, music, queue, created_at)
      values (u[1 + (k % array_length(u, 1))], e.id, lvl::smallint, vibes[least(3, lvl)], 'bom', queues[least(4, lvl)],
              now() - make_interval(mins => 170 - k * 45));
    end loop;
    -- relatos frescos (últimos 80 min) que formam o termômetro
    n := least(array_length(u, 1), 3 + e.demo_crowd);
    for i in 1..n loop
      insert into live_reports (user_id, event_id, crowd, vibe, music, queue, created_at)
      values (u[i], e.id,
              greatest(1, least(4, e.demo_crowd + (case when i % 4 = 0 then -1 else 0 end)))::smallint,
              vibes[least(3, e.demo_crowd)], case when i % 3 = 0 then null else 'bom' end,
              queues[least(4, e.demo_crowd)],
              now() - make_interval(mins => 2 + (i * 11) % 75));
    end loop;
  end loop;

  -- ── social (Social 2–5): stories de 24 h, check-ins, localização do grupo e conversas sempre "de agora"
  update stories s set created_at = now() - make_interval(mins => 10 + abs(hashtext(s.id::text)) % 300),
                       expires_at = now() - make_interval(mins => 10 + abs(hashtext(s.id::text)) % 300) + interval '24 hours'
  where s.author_id in (select id from profiles where is_demo);
  update check_ins c set created_at = now() - make_interval(mins => 5 + abs(hashtext(c.user_id::text || c.event_id::text)) % 150), reveal_at = null
  where c.user_id in (select id from profiles where is_demo) and c.event_id in (select id from events where is_demo);
  update group_locations l set updated_at = now() - make_interval(mins => 1 + abs(hashtext(l.user_id::text)) % 6),
                               expires_at = now() + interval '90 minutes'
  where l.user_id in (select id from profiles where is_demo);
  update conversations c set last_message_at = now() - interval '25 minutes'
  where exists (select 1 from conversation_members m join profiles p on p.id = m.user_id where m.conversation_id = c.id and p.is_demo);
  update messages m set created_at = now() - make_interval(mins => 25 + abs(hashtext(m.id::text)) % 40)
  where m.sender_id in (select id from profiles where is_demo);
end $$;
revoke execute on function public.demo_refresh() from public, anon, authenticated;

-- remove também o que os perfis demo criaram com gente real (conversas e grupos somem em cascata)
create or replace function public.demo_purge()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from conversations c where exists (select 1 from conversation_members m join profiles p on p.id = m.user_id
                                            where m.conversation_id = c.id and p.is_demo);
  delete from live_reports where event_id in (select id from events where is_demo);
  delete from posts where is_demo;
  delete from events where is_demo;
  delete from auth.users where id in (select id from profiles where is_demo);
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'fomo_demo_refresh') then
    perform cron.unschedule('fomo_demo_refresh');
  end if;
end $$;
revoke execute on function public.demo_purge() from public, anon, authenticated;

-- sugestões passam a incluir perfis demo (vitrine enquanto o app não tem usuários; somem com demo_purge)
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
    where p.id <> (select id from me)
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
