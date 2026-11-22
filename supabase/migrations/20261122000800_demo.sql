-- ============================================================================
-- FOMO · 0008 · Conteúdo de demonstração (beta com amigos)
-- Objetivo: quem entra pela primeira vez não encontra um app vazio.
-- Regras de honestidade:
--  - tudo que é demo tem is_demo = true e aparece com selo "DEMO" no app;
--  - perfis demo não conseguem logar (sem senha) e não são pessoas reais;
--  - locais e endereços são fictícios (bairros reais só para posicionar no mapa);
--  - relatos ao vivo demo são gerados pelo servidor e renovados de hora em hora.
-- Remover tudo: select public.demo_purge();
-- ============================================================================

alter table public.profiles add column if not exists is_demo boolean not null default false;
alter table public.events   add column if not exists is_demo boolean not null default false;
alter table public.events   add column if not exists demo_schedule text;   -- 'live' | 'd+N@HH'
alter table public.events   add column if not exists demo_crowd smallint check (demo_crowd between 1 and 4);
alter table public.posts    add column if not exists is_demo boolean not null default false;
alter table public.posts    add column if not exists demo_age_min int;

-- cliente nunca cria conteúdo marcado como demo
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (created_by = (select auth.uid()) and status = 'pending' and not is_sponsored and sponsored_until is null
              and moderated_by is null and not is_demo and demo_schedule is null and demo_crowd is null);

-- Reposiciona horários e renova relatos ao vivo dos eventos demo.
create or replace function public.demo_refresh()
returns void language plpgsql security definer set search_path = public as $$
declare
  t0 timestamptz := date_trunc('hour', now());
  day0 timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  e record;
  u uuid[];
  n int;
  i int;
  vibes text[] := array['ok', 'bom', 'bombando'];
  queues text[] := array['sem_fila', 'curta', 'media', 'longa'];
begin
  -- eventos "ao vivo": sempre acontecendo (janela móvel)
  update events set status = 'approved', starts_at = t0 - interval '2 hours', ends_at = t0 + interval '5 hours'
  where is_demo and demo_schedule = 'live';
  -- eventos futuros: N dias à frente, HH horas (horário de SP)
  update events set status = 'approved',
    starts_at = day0 + make_interval(days => split_part(substr(demo_schedule, 3), '@', 1)::int,
                                     hours => split_part(demo_schedule, '@', 2)::int),
    ends_at = null
  where is_demo and demo_schedule like 'd+%@%';

  -- publicações demo continuam "recentes"
  update posts set created_at = now() - make_interval(mins => demo_age_min), updated_at = now() - make_interval(mins => demo_age_min)
  where is_demo and demo_age_min is not null;

  -- relatos ao vivo demo (anônimos no agregado, como os reais)
  delete from live_reports where event_id in (select id from events where is_demo);
  select array_agg(id order by id) into u from profiles where is_demo;
  if u is null then return; end if;
  for e in select id, demo_crowd from events where is_demo and demo_schedule = 'live' and demo_crowd is not null loop
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

-- Remove TODO o conteúdo demo (rodar antes de abrir ao público).
create or replace function public.demo_purge()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from live_reports where event_id in (select id from events where is_demo);
  delete from posts where is_demo;
  delete from events where is_demo;
  delete from auth.users where id in (select id from profiles where is_demo);
end $$;
revoke execute on function public.demo_purge() from public, anon, authenticated;


-- mapa passa a informar o selo DEMO (mesma função; só acrescenta isDemo ao JSON)
create or replace function public.events_in_bounds(
  p_north double precision, p_south double precision, p_east double precision, p_west double precision,
  p_origin_lat double precision default null, p_origin_lng double precision default null,
  p_category_slug text default null,
  p_date text default 'today',          -- now | today | weekend | any
  p_max_distance_km double precision default null,
  p_price text default 'any',           -- any | free | upTo50 | over50
  p_query text default null,
  p_limit int default 100
)
returns table (event jsonb) language sql stable security definer set search_path = public, private as $$
  with base as (
    select e.*, c.slug as category_slug, c.name as category_name,
      is_happening_now(e) as now_live,
      case when p_origin_lat is not null then haversine_m(p_origin_lat, p_origin_lng, e.latitude, e.longitude) end as dist
    from events e join event_categories c on c.id = e.category_id
    where e.status = 'approved'
      and coalesce(e.ends_at, e.starts_at + interval '8 hours') > now()
      and e.latitude between p_south and p_north
      and e.longitude between p_west and p_east
      and (p_category_slug is null or c.slug = p_category_slug)
      and (p_query is null or e.title ilike '%' || p_query || '%' or e.venue_name ilike '%' || p_query || '%' or e.address ilike '%' || p_query || '%')
      and (case p_price
             when 'free' then coalesce(e.price_min_cents, e.price_max_cents) = 0
             when 'upTo50' then coalesce(e.price_min_cents, e.price_max_cents) <= 5000
             when 'over50' then coalesce(e.price_min_cents, e.price_max_cents) > 5000
             else true end)
  ),
  filtered as (
    select * from base
    where (case p_date
             when 'now' then now_live
             when 'today' then starts_at <= (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '30 hours') at time zone 'America/Sao_Paulo'
             when 'weekend' then extract(isodow from starts_at at time zone 'America/Sao_Paulo') in (6, 7)
                              or (extract(isodow from starts_at at time zone 'America/Sao_Paulo') = 5 and extract(hour from starts_at at time zone 'America/Sao_Paulo') >= 18)
             else true end)
      and (p_max_distance_km is null or dist is null or dist <= p_max_distance_km * 1000)
  )
  select jsonb_build_object(
    'id', f.id, 'title', f.title, 'description', f.description, 'categoryId', f.category_id, 'status', f.status,
    'startsAt', f.starts_at, 'endsAt', f.ends_at, 'venueName', f.venue_name, 'address', f.address,
    'latitude', f.latitude, 'longitude', f.longitude, 'priceMinCents', f.price_min_cents, 'priceMaxCents', f.price_max_cents,
    'ticketUrl', f.ticket_url, 'coverUrl', f.cover_path, 'organizerId', f.organizer_id, 'createdBy', f.created_by,
    'isDemo', f.is_demo, 'isSponsored', f.is_sponsored and coalesce(f.sponsored_until > now(), true), 'createdAt', f.created_at,
    'category', jsonb_build_object('id', f.category_id, 'slug', f.category_slug, 'name', f.category_name),
    'savedByMe', exists (select 1 from saved_events s where s.user_id = auth.uid() and s.event_id = f.id),
    'happeningNow', f.now_live,
    'distanceM', f.dist,
    'live', case when f.now_live then live_status(f.id) end
  )
  from filtered f
  -- ordenação explicável: lotação (agora) > distância > horário. Patrocínio não influencia.
  order by case when f.now_live then coalesce((live_status(f.id)->>'crowd')::int, 0) + 1 else 0 end desc,
           f.dist nulls last, f.starts_at
  limit least(greatest(p_limit, 1), 200);
$$;
