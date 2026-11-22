-- ============================================================================
-- FOMO · 0002 · Funções, triggers e RPCs
-- Regra: tudo que mexe em XP, credibilidade, contadores, status de follow ou
-- verificação de presença acontece AQUI, nunca no cliente.
-- Funções security definer usam search_path fixo (proteção contra hijack).
-- ============================================================================

-- ─────────────────────────── Helpers de autorização ───────────────────────────

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.follow_status(follower uuid, followee uuid)
returns text language sql stable security definer set search_path = public as $$
  select status from follows where follower_id = follower and followee_id = followee;
$$;

-- Pode ver conteúdo (posts/histórico) do perfil? Dono; ou não bloqueado e (público ou seguidor aceito).
create or replace function public.can_view_profile_content(viewer uuid, owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when viewer is not null and viewer = owner then true
    when viewer is not null and is_blocked(viewer, owner) then false
    else coalesce((select not p.is_private from profiles p where p.id = owner), false)
      or (viewer is not null and follow_status(viewer, owner) = 'accepted')
  end;
$$;

-- Pode ver um item com visibilidade própria?
create or replace function public.can_view_item(viewer uuid, owner uuid, visibility text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when viewer is not null and viewer = owner then true
    when viewer is not null and is_blocked(viewer, owner) then false
    when visibility = 'private' then false
    when visibility = 'followers' then viewer is not null and follow_status(viewer, owner) = 'accepted'
    else can_view_profile_content(viewer, owner)
  end;
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_moderator from profiles where id = auth.uid()), false);
$$;

-- ─────────────────────────── updated_at ───────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();
create trigger comments_touch before update on public.comments for each row execute function public.touch_updated_at();

-- ─────────────────────────── Perfil: criação com @username ───────────────────────────

-- Chamado após o login (tela "escolha seu @"). Idempotente.
create or replace function public.claim_profile(p_username text, p_display_name text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  u text := lower(trim(p_username));
  result profiles;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if u !~ '^[a-z0-9_.]{3,30}$' then raise exception 'invalid_username' using errcode = '22023'; end if;
  if u in ('admin', 'fomo', 'suporte', 'moderacao', 'oficial') then raise exception 'reserved_username' using errcode = '22023'; end if;
  insert into profiles (id, username, display_name)
  values (uid, u, coalesce(nullif(trim(p_display_name), ''), u))
  on conflict (id) do update set username = excluded.username, display_name = excluded.display_name
  returning * into result;
  return result;
exception when unique_violation then
  raise exception 'username_taken' using errcode = '23505';
end $$;

-- ─────────────────────────── Follows ───────────────────────────

-- Status definido pelo servidor: perfil público → accepted; privado → pending.
create or replace function public.follows_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_blocked(new.follower_id, new.followee_id) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  new.status := case when (select is_private from profiles where id = new.followee_id) then 'pending' else 'accepted' end;
  new.responded_at := case when new.status = 'accepted' then now() else null end;
  return new;
end $$;
create trigger follows_status before insert on public.follows for each row execute function public.follows_before_insert();

-- Só o seguido pode mudar pending → accepted; nada mais muda.
create or replace function public.follows_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.follower_id <> old.follower_id or new.followee_id <> old.followee_id then
    raise exception 'immutable' using errcode = '42501';
  end if;
  if not (old.status = 'pending' and new.status = 'accepted') then
    raise exception 'invalid_transition' using errcode = '42501';
  end if;
  new.responded_at := now();
  return new;
end $$;
create trigger follows_transition before update on public.follows for each row execute function public.follows_before_update();

create or replace function public.follows_counters()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'accepted' then
    update profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
    insert into notifications (user_id, type, actor_id) values (new.followee_id, 'follow', new.follower_id);
  elsif tg_op = 'INSERT' and new.status = 'pending' then
    insert into notifications (user_id, type, actor_id) values (new.followee_id, 'follow_request', new.follower_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    update profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
    insert into notifications (user_id, type, actor_id) values (new.follower_id, 'follow_accepted', new.followee_id);
  elsif tg_op = 'DELETE' and old.status = 'accepted' then
    update profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
    update profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  end if;
  return null;
end $$;
create trigger follows_count after insert or update or delete on public.follows for each row execute function public.follows_counters();

-- Bloquear desfaz follows nas duas direções.
create or replace function public.blocks_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return null;
end $$;
create trigger blocks_unfollow after insert on public.blocks for each row execute function public.blocks_after_insert();

-- Perfil que vira público aprova solicitações pendentes.
create or replace function public.profiles_privacy_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_private and not new.is_private then
    update follows set status = 'accepted' where followee_id = new.id and status = 'pending';
  end if;
  return null;
end $$;
create trigger profiles_privacy after update of is_private on public.profiles for each row execute function public.profiles_privacy_change();

-- ─────────────────────────── XP e níveis ───────────────────────────

create or replace function public.level_for_xp(p_xp int)
returns int language sql stable set search_path = public as $$
  select coalesce(max(level), 1) from level_definitions where min_xp <= p_xp;
$$;

-- Concede XP respeitando regra ativa, limite diário, cooldown e unicidade por fonte.
-- Retorna o valor concedido (0 se bloqueado). NÃO exposto ao cliente.
create or replace function public.award_xp(p_user uuid, p_rule text, p_source_type text, p_source_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  r xp_rules;
  today_count int;
  last_at timestamptz;
begin
  select * into r from xp_rules where key = p_rule and active;
  if not found or r.amount = 0 then return 0; end if;

  select count(*), max(created_at) into today_count, last_at
  from user_xp_transactions
  where user_id = p_user and rule_key = p_rule and status <> 'reverted'
    and created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  if today_count >= r.daily_cap then return 0; end if;
  if last_at is not null and r.cooldown_seconds > 0 and now() - last_at < make_interval(secs => r.cooldown_seconds) then return 0; end if;

  insert into user_xp_transactions (user_id, rule_key, amount, source_type, source_id, status)
  values (p_user, p_rule, r.amount, p_source_type, p_source_id, case when r.requires_review then 'pending' else 'granted' end)
  on conflict (user_id, rule_key, source_id) do nothing;
  if not found then return 0; end if;
  return r.amount;
end $$;
revoke execute on function public.award_xp(uuid, text, text, uuid) from public, anon, authenticated;

-- Mantém profiles.xp/level como soma do livro-razão (status granted).
create or replace function public.xp_tx_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  total int;
begin
  select coalesce(sum(amount), 0) into total from user_xp_transactions where user_id = uid and status = 'granted';
  update profiles set xp = greatest(total, 0), level = level_for_xp(greatest(total, 0)) where id = uid;
  return null;
end $$;
create trigger xp_tx_after after insert or update or delete on public.user_xp_transactions for each row execute function public.xp_tx_sync();

-- ─────────────────────────── Posts: contadores, XP, exclusão ───────────────────────────

create or replace function public.posts_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.event_id is not null or new.place_name is not null or new.experience_date is not null then
      update profiles set total_experiences = total_experiences + 1 where id = new.author_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.event_id is not null or old.place_name is not null or old.experience_date is not null then
      update profiles set total_experiences = greatest(total_experiences - 1, 0) where id = old.author_id;
    end if;
    -- XP ganho com o post é revertido
    update user_xp_transactions set status = 'reverted' where source_type = 'post' and source_id = old.id;
  end if;
  return null;
end $$;
create trigger posts_after after insert or delete on public.posts for each row execute function public.posts_after_change();

create or replace function public.likes_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  if tg_op = 'INSERT' then
    update posts set likes_count = likes_count + 1 where id = new.post_id returning author_id into author;
    if author is not null and author <> new.user_id then
      insert into notifications (user_id, type, actor_id, entity_type, entity_id) values (author, 'like', new.user_id, 'post', new.post_id);
    end if;
  else
    update posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger likes_count after insert or delete on public.likes for each row execute function public.likes_counter();

create or replace function public.comments_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  if tg_op = 'INSERT' then
    update posts set comments_count = comments_count + 1 where id = new.post_id returning author_id into author;
    if author is not null and author <> new.author_id then
      insert into notifications (user_id, type, actor_id, entity_type, entity_id) values (author, 'comment', new.author_id, 'post', new.post_id);
    end if;
  else
    update posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger comments_count after insert or delete on public.comments for each row execute function public.comments_counter();

create or replace function public.reviews_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update profiles set total_reviews = total_reviews + 1 where id = new.author_id;
    perform award_xp(new.author_id, 'review', 'review', new.id);
  else
    update profiles set total_reviews = greatest(total_reviews - 1, 0) where id = old.author_id;
    update user_xp_transactions set status = 'reverted' where source_type = 'review' and source_id = old.id;
  end if;
  return null;
end $$;
create trigger reviews_count after insert or delete on public.reviews for each row execute function public.reviews_counter();

create or replace function public.review_votes_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  if tg_op = 'INSERT' then
    update reviews set helpful_count = helpful_count + 1 where id = new.review_id returning author_id into author;
    if author = new.voter_id then raise exception 'cannot_vote_own_review' using errcode = '42501'; end if;
    perform award_xp(author, 'review_helpful', 'review_vote', gen_random_uuid());
  else
    update reviews set helpful_count = greatest(helpful_count - 1, 0) where id = old.review_id;
  end if;
  return null;
end $$;
create trigger review_votes_count after insert or delete on public.review_votes for each row execute function public.review_votes_counter();

-- ─────────────────────────── Criar publicação (atômico) ───────────────────────────

-- Cria post + mídias (já enviadas ao Storage em post-media/{uid}/{post_id}/...) + check-in declarado opcional.
-- O cliente gera o post_id para montar os caminhos antes do upload.
create or replace function public.create_post(
  p_post_id uuid,
  p_body text,
  p_media jsonb,              -- [{ "path": "...", "width": 1080, "height": 1350 }]
  p_event_id uuid default null,
  p_place_name text default null,
  p_experience_date date default null,
  p_category_id uuid default null,
  p_rating smallint default null,
  p_visibility text default 'public',
  p_declare_presence boolean default false
)
returns public.posts language plpgsql security definer set search_path = public as $$
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

-- ─────────────────────────── Mapa ───────────────────────────

create or replace function public.haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = public as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.is_happening_now(e public.events, at_time timestamptz default now())
returns boolean language sql stable set search_path = public as $$
  select e.status = 'approved' and e.starts_at <= at_time and coalesce(e.ends_at, e.starts_at + interval '6 hours') > at_time;
$$;

-- Agregado do termômetro (só relatos frescos; só exibe lotação com mínimo de relatos).
create or replace function public.live_status(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with cfg as (select * from live_config limit 1),
  recent as (
    select r.* from live_reports r, cfg
    where r.event_id = p_event_id and r.created_at >= now() - make_interval(mins => cfg.report_ttl_min)
  ),
  agg as (
    select count(*) as n, max(created_at) as last_at,
      percentile_disc(0.5) within group (order by crowd) as crowd_median,
      mode() within group (order by vibe) as vibe,
      mode() within group (order by music) filter (where music is not null) as music,
      mode() within group (order by queue) as queue
    from recent
  )
  select jsonb_build_object(
    'eventId', p_event_id,
    'reportsCount', agg.n,
    'lastReportAt', agg.last_at,
    'crowd', case when agg.n >= cfg.min_reports_to_show then agg.crowd_median end,
    'vibe', case when agg.n >= cfg.min_reports_to_show then agg.vibe end,
    'music', case when agg.n >= cfg.min_reports_to_show then agg.music end,
    'queue', case when agg.n >= cfg.min_reports_to_show then agg.queue end,
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object('hour', to_char(h, 'HH24') || 'h', 'crowd', c) order by h)
      from (
        select date_trunc('hour', r.created_at at time zone 'America/Sao_Paulo') as h,
               round(avg(r.crowd))::int as c
        from live_reports r
        where r.event_id = p_event_id and r.created_at >= now() - interval '12 hours'
        group by 1
      ) t
    ), '[]'::jsonb)
  )
  from agg, cfg;
$$;

-- Eventos na área visível + filtros. Nunca retorna mais que p_limit.
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
returns table (event jsonb) language sql stable security definer set search_path = public as $$
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
    'isSponsored', f.is_sponsored and coalesce(f.sponsored_until > now(), true), 'createdAt', f.created_at,
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

-- ─────────────────────────── Relato ao vivo ───────────────────────────

create or replace function public.submit_live_report(
  p_event_id uuid, p_crowd smallint, p_vibe text, p_music text, p_queue text,
  p_lat double precision, p_lng double precision
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e events;
  cfg live_config;
  d double precision;
  rid uuid;
  xp int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into cfg from live_config limit 1;
  select * into e from events where id = p_event_id;
  if not found or not is_happening_now(e) then raise exception 'event_not_live' using errcode = '22023'; end if;

  d := haversine_m(p_lat, p_lng, e.latitude, e.longitude);
  if d > cfg.max_distance_m then
    raise exception 'too_far:%', round(d)::int using errcode = '42501';
  end if;
  if exists (select 1 from live_reports where user_id = uid and event_id = p_event_id
             and created_at > now() - make_interval(mins => cfg.cooldown_min)) then
    raise exception 'cooldown' using errcode = '54000';
  end if;
  if (select count(*) from live_reports where user_id = uid and created_at > now() - interval '24 hours') >= cfg.max_reports_per_day then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  -- coordenadas usadas só na comparação acima; NÃO são gravadas
  insert into live_reports (user_id, event_id, crowd, vibe, music, queue)
  values (uid, p_event_id, p_crowd, p_vibe, p_music, p_queue)
  returning id into rid;

  xp := award_xp(uid, 'live_report', 'live_report', rid); -- regra com requires_review → pending

  return jsonb_build_object(
    'accepted', true,
    'xpPending', xp,
    'expiresAt', now() + make_interval(mins => cfg.report_ttl_min)
  );
end $$;

-- Job (pg_cron, a cada 15 min): confirma XP pendente de relatos coerentes com a maioria
-- e reverte os destoantes (|crowd − mediana| ≥ 2) — anti-manipulação.
create or replace function public.confirm_pending_live_xp()
returns int language plpgsql security definer set search_path = public as $$
declare changed int;
begin
  with pending as (
    select t.id as tx_id, r.event_id, r.crowd, r.created_at
    from user_xp_transactions t join live_reports r on r.id = t.source_id
    where t.rule_key = 'live_report' and t.status = 'pending' and t.created_at < now() - interval '20 minutes'
  ),
  judged as (
    select p.tx_id,
      abs(p.crowd - (select percentile_disc(0.5) within group (order by r2.crowd) from live_reports r2
                     where r2.event_id = p.event_id and r2.created_at between p.created_at - interval '45 minutes' and p.created_at + interval '45 minutes')) as dev
    from pending p
  )
  update user_xp_transactions t set status = case when j.dev >= 2 then 'reverted' else 'granted' end
  from judged j where t.id = j.tx_id;
  get diagnostics changed = row_count;
  return changed;
end $$;
revoke execute on function public.confirm_pending_live_xp() from public, anon, authenticated;

-- Job (pg_cron, a cada 10 min): encerra eventos passados.
create or replace function public.end_past_events()
returns int language sql security definer set search_path = public as $$
  with u as (
    update events set status = 'ended'
    where status = 'approved' and coalesce(ends_at, starts_at + interval '8 hours') < now()
    returning 1
  ) select count(*)::int from u;
$$;
revoke execute on function public.end_past_events() from public, anon, authenticated;

-- ─────────────────────────── Credibilidade (v1, documentada) ───────────────────────────
-- 0–100 = 35·úteis + 20·consistência + 20·moderação + 10·diversidade + 15·presença confirmada
-- Seguidores e curtidas NÃO entram. Votos de útil contam por votante distinto, e só de
-- votantes com conta > 7 dias (anti contas falsas).
create or replace function public.recompute_credibility(p_user uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  helpful_voters int; active_weeks int; removed int; categories int; verified int;
  f_helpful numeric; f_consistency numeric; f_moderation numeric; f_diversity numeric; f_verified numeric; score numeric;
begin
  select count(distinct v.voter_id) into helpful_voters
  from review_votes v join reviews r on r.id = v.review_id join profiles vp on vp.id = v.voter_id
  where r.author_id = p_user and vp.created_at < now() - interval '7 days';

  select count(distinct date_trunc('week', created_at)) into active_weeks
  from (select created_at from posts where author_id = p_user and moderation_status = 'visible'
        union all select created_at from reviews where author_id = p_user and moderation_status = 'visible') x
  where created_at > now() - interval '12 weeks';

  select (select count(*) from posts where author_id = p_user and moderation_status = 'removed')
       + (select count(*) from reviews where author_id = p_user and moderation_status = 'removed')
       + (select count(*) from comments where author_id = p_user and moderation_status = 'removed')
  into removed;

  select count(distinct coalesce(p.category_id, e.category_id)) into categories
  from posts p left join events e on e.id = p.event_id
  where p.author_id = p_user and p.moderation_status = 'visible';

  select count(*) into verified from check_ins where user_id = p_user and status = 'verified';

  f_helpful := 35 * least(1, ln(1 + helpful_voters) / ln(51));
  f_consistency := 20 * least(1, active_weeks / 12.0);
  f_moderation := greatest(0, 20 - 5 * removed);
  f_diversity := 10 * least(1, categories / 5.0);
  f_verified := 15 * least(1, verified / 10.0);
  score := round(f_helpful + f_consistency + f_moderation + f_diversity + f_verified, 2);

  update profiles set credibility_score = score where id = p_user;
  insert into credibility_snapshots (user_id, score, factors, formula_version)
  values (p_user, score, jsonb_build_object(
    'helpful_reviews', round(f_helpful, 2), 'consistency', round(f_consistency, 2),
    'moderation_history', round(f_moderation, 2), 'diversity', round(f_diversity, 2),
    'verified_presence', round(f_verified, 2)), 1);
  return score;
end $$;
revoke execute on function public.recompute_credibility(uuid) from public, anon, authenticated;

-- ─────────────────────────── Feed ───────────────────────────

-- "Seguindo": cronológico, cursor = created_at do último item.
-- "Para você": pontuação explicável (pesos documentados), cursor = offset.
create or replace function public.feed(p_tab text, p_cursor text default null, p_limit int default 15)
returns setof public.posts language sql stable security definer set search_path = public as $$
  select p.* from posts p
  join profiles a on a.id = p.author_id
  where p.moderation_status = 'visible'
    and can_view_item(auth.uid(), p.author_id, p.visibility)
    and (
      (p_tab = 'following'
        and (p.author_id = auth.uid()
             or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.author_id and f.status = 'accepted'))
        and (p_cursor is null or p.created_at < p_cursor::timestamptz))
      or
      (p_tab = 'for_you' and p.author_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
        and p.visibility = 'public' and p.created_at > now() - interval '14 days')
    )
  order by
    case when p_tab = 'following' then extract(epoch from p.created_at) end desc nulls last,
    case when p_tab = 'for_you' then
        0.45 * exp(-extract(epoch from (now() - p.created_at)) / 86400.0)    -- atualidade (meia-vida ~17h)
      + 0.30 * (a.credibility_score / 100.0)                                 -- qualidade de quem publica
      + 0.15 * least(1, p.media_count / 3.0)                                 -- tem fotos
      + 0.10 * least(1, ln(1 + p.likes_count) / ln(1000))                    -- engajamento (peso baixo, saturado)
    end desc nulls last,
    p.id
  limit least(greatest(p_limit, 1), 50)
  offset case when p_tab = 'for_you' and p_cursor ~ '^[0-9]+$' then p_cursor::int else 0 end;
$$;
