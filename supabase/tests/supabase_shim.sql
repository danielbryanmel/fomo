-- Shim mínimo do ambiente Supabase para testar as migrations fora da nuvem (PGlite/Postgres puro).
-- NÃO é migration. Reproduz: papéis anon/authenticated, auth.users, auth.uid(), storage.buckets/objects,
-- storage.foldername() e os GRANTs padrão que o Supabase dá aos papéis no schema public.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid default auth.uid(),
  created_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
-- Supabase: funções novas são executáveis por PUBLIC (o shim reproduz o padrão)
grant select on storage.buckets to anon, authenticated;

-- Padrão Supabase: papéis da API recebem privilégios no schema public (a RLS é quem restringe)
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
