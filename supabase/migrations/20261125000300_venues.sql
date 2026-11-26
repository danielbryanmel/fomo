-- Lugares reais (bares, baladas, casas de show) para o mapa ficar com cara de cidade de verdade.
-- Só leitura para o app; quem escreve é a equipe (migration/SQL), nunca o cliente.
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  kind text not null check (kind in ('bar', 'balada', 'samba', 'pub', 'casa_de_show', 'ponto')),
  category_id uuid references public.event_categories (id),
  neighborhood text check (char_length(neighborhood) <= 80),
  address text not null check (char_length(address) <= 240),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- 'numero' = coordenada do número/estabelecimento; 'rua' = só a rua (aproximado)
  geo_precision text not null default 'numero' check (geo_precision in ('numero', 'rua')),
  source_url text check (source_url ~* '^https://'),
  checked_at date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, address)
);
create index if not exists venues_geo_idx on public.venues (latitude, longitude) where is_active;

alter table public.venues enable row level security;
drop policy if exists venues_read on public.venues;
create policy venues_read on public.venues for select to anon, authenticated using (is_active);
revoke insert, update, delete on public.venues from anon, authenticated;
grant select on public.venues to anon, authenticated;

-- rolê pode apontar para um lugar cadastrado (opcional)
alter table public.events add column if not exists venue_id uuid references public.venues (id) on delete set null;
create index if not exists events_venue_idx on public.events (venue_id) where venue_id is not null;
