-- ============================================================================
-- FOMO · 0001 · Esquema principal
-- Convenções: uuid PK, timestamptz, snake_case, CHECK em vez de enums (evolui sem
-- ALTER TYPE), contadores mantidos por trigger (nunca pelo cliente).
-- Geolocalização: latitude/longitude numéricas + índice composto (consulta por
-- bounding box). Migrar para PostGIS quando o volume exigir (ver docs/DATA_MODEL.md).
-- ============================================================================

-- gen_random_uuid() é nativo do Postgres 13+ (sem extensão).

-- ─────────────────────────── Perfis ───────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null check (char_length(display_name) between 1 and 50),
  avatar_url text,
  bio text check (char_length(bio) <= 280),
  city text check (char_length(city) <= 60),
  is_private boolean not null default false,
  default_checkin_visibility text not null default 'followers'
    check (default_checkin_visibility in ('public', 'followers', 'private')),

  -- Experiência (XP/nível) — escritos só por funções do servidor
  level int not null default 1 check (level between 1 and 7),
  xp int not null default 0 check (xp >= 0),
  -- Credibilidade (0–100) — calculada no servidor, separada de popularidade
  credibility_score numeric(5, 2) not null default 0 check (credibility_score between 0 and 100),

  -- Contadores (trigger)
  total_experiences int not null default 0,
  total_reviews int not null default 0,
  followers_count int not null default 0,
  following_count int not null default 0,

  is_moderator boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_.]{3,30}$')
);
create unique index profiles_username_key on public.profiles (lower(username));

-- ─────────────────────────── Relações sociais ───────────────────────────
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id, status);
create index follows_follower_idx on public.follows (follower_id, status);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ─────────────────────────── Eventos ───────────────────────────
create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,30}$'),
  name text not null,
  sort_order int not null default 0
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 4000),
  category_id uuid not null references public.event_categories (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'cancelled', 'ended')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text check (char_length(venue_name) <= 120),
  address text check (char_length(address) <= 240),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  price_min_cents int check (price_min_cents >= 0),
  price_max_cents int check (price_max_cents >= 0),
  ticket_url text check (ticket_url ~* '^https://'),
  cover_path text,
  organizer_id uuid references public.profiles (id) on delete set null, -- futuro: organizer_profiles
  created_by uuid not null references public.profiles (id) on delete cascade,
  is_sponsored boolean not null default false,
  sponsored_until timestamptz,
  moderated_by uuid references public.profiles (id),
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (price_max_cents is null or price_min_cents is null or price_max_cents >= price_min_cents)
);
create index events_geo_idx on public.events (latitude, longitude) where status = 'approved';
create index events_time_idx on public.events (status, starts_at);
create index events_category_idx on public.events (category_id);
create index events_created_by_idx on public.events (created_by);

-- ─────────────────────────── Presença ───────────────────────────
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  status text not null default 'declared' check (status in ('declared', 'verified')),
  verification_method text check (verification_method in ('organizer_code', 'qr_code', 'one_time_location', 'admin_review')),
  visibility text not null default 'followers' check (visibility in ('public', 'followers', 'private')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  check ((status = 'declared' and verification_method is null) or (status = 'verified' and verification_method is not null))
);
create unique index check_ins_one_per_event on public.check_ins (user_id, event_id) where event_id is not null;
create index check_ins_user_idx on public.check_ins (user_id, created_at desc);

-- ─────────────────────────── Publicações (rolê vivido) ───────────────────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text check (char_length(body) <= 2200),
  event_id uuid references public.events (id) on delete set null,
  place_name text check (char_length(place_name) <= 120),
  experience_date date check (experience_date <= (now() at time zone 'America/Sao_Paulo')::date + 1),
  category_id uuid references public.event_categories (id),
  rating smallint check (rating between 1 and 5),
  check_in_id uuid references public.check_ins (id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  media_count smallint not null default 0 check (media_count between 0 and 10),
  likes_count int not null default 0,
  comments_count int not null default 0,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- post precisa ter texto OU foto
  check (coalesce(char_length(body), 0) > 0 or media_count > 0)
);
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_feed_idx on public.posts (created_at desc) where moderation_status = 'visible';
create index posts_event_idx on public.posts (event_id) where event_id is not null;

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  storage_path text not null, -- post-media/{author_id}/{post_id}/{uuid}.jpg
  width int check (width > 0),
  height int check (height > 0),
  position smallint not null check (position between 0 and 9),
  blurhash text,
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

-- ─────────────────────────── Avaliações ───────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 1000),
  post_id uuid references public.posts (id) on delete set null,
  helpful_count int not null default 0,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, event_id)
);
create index reviews_event_idx on public.reviews (event_id, created_at desc);

create table public.review_votes (
  review_id uuid not null references public.reviews (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, voter_id)
);

-- ─────────────────────────── Interações ───────────────────────────
create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.saved_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table public.saved_posts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ─────────────────────────── Termômetro ao vivo ───────────────────────────
create table public.live_config (
  id boolean primary key default true check (id), -- linha única
  report_ttl_min int not null default 90,
  min_reports_to_show int not null default 3,
  max_distance_m int not null default 200,
  cooldown_min int not null default 30,
  max_reports_per_day int not null default 12
);

create table public.live_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  crowd smallint not null check (crowd between 1 and 4),
  vibe text not null check (vibe in ('chato', 'ok', 'bom', 'bombando')),
  music text check (music in ('ruim', 'ok', 'bom', 'sem_som')),
  queue text not null check (queue in ('sem_fila', 'curta', 'media', 'longa')),
  verification text not null default 'one_time_location' check (verification = 'one_time_location'),
  created_at timestamptz not null default now()
  -- coordenadas NÃO são armazenadas
);
create index live_reports_event_idx on public.live_reports (event_id, created_at desc);
create index live_reports_user_idx on public.live_reports (user_id, event_id, created_at desc);

-- ─────────────────────────── Gamificação ───────────────────────────
create table public.level_definitions (
  level int primary key check (level between 1 and 7),
  name text not null,
  min_xp int not null unique check (min_xp >= 0)
);

create table public.xp_rules (
  key text primary key,
  description text not null,
  amount int not null check (amount between 0 and 1000),
  daily_cap int not null default 10 check (daily_cap >= 0),
  cooldown_seconds int not null default 0,
  requires_review boolean not null default false, -- entra como 'pending'
  active boolean not null default true
);

create table public.user_xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rule_key text not null references public.xp_rules (key),
  amount int not null,
  source_type text not null,
  source_id uuid not null,
  status text not null default 'granted' check (status in ('pending', 'granted', 'reverted')),
  reviewed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (user_id, rule_key, source_id)
);
create index xp_tx_user_idx on public.user_xp_transactions (user_id, created_at desc);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  icon text,
  criteria jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.credibility_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  score numeric(5, 2) not null,
  factors jsonb not null,
  formula_version int not null,
  computed_at timestamptz not null default now()
);
create index credibility_user_idx on public.credibility_snapshots (user_id, computed_at desc);

-- ─────────────────────────── Moderação e avisos ───────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'profile', 'event', 'review')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'inapropriado', 'falso', 'assedio', 'violencia', 'outro')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  unique (reporter_id, target_type, target_id)
);
create index reports_status_idx on public.reports (status, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('follow', 'follow_request', 'follow_accepted', 'like', 'comment', 'achievement', 'event_approved', 'moderation')),
  actor_id uuid references public.profiles (id) on delete cascade,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
