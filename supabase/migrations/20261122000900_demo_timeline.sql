-- ============================================================================
-- FOMO · 0009 · Demo: histórico da noite
-- Os rolês demo "ao vivo" passam a ter relatos espalhados pelas últimas ~3 h
-- (a noite "enche" aos poucos), para o gráfico "como tá a noite" fazer sentido.
-- A lotação ao vivo continua vindo só dos relatos dos últimos 90 min (regra real).
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
              now() - make_interval(mins => (i * 9) % 80));
    end loop;
  end loop;
end $$;
revoke execute on function public.demo_refresh() from public, anon, authenticated;
