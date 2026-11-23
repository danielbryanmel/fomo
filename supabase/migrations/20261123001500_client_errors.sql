-- ============================================================================
-- FOMO · 0015 · Registro de erros do app + "Reportar problema"
-- O app manda erros inesperados (mensagem técnica, tela, aparelho) e relatos
-- escritos por quem testa. Sem e-mail, sem localização, sem conteúdo de posts.
-- Ninguém lê pelo app: só pelo painel/SQL. Limite por pessoa contra abuso.
-- ============================================================================
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('error', 'feedback')),
  route text check (char_length(route) <= 200),
  message text not null check (char_length(message) between 1 and 2000),
  detail text check (char_length(detail) <= 4000),
  user_agent text check (char_length(user_agent) <= 300),
  app_version text check (char_length(app_version) <= 40)
);
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
create index if not exists client_errors_user_idx on public.client_errors (user_id);
alter table public.client_errors enable row level security;
-- sem policies: cliente não lê nem escreve direto
revoke all on public.client_errors from anon, authenticated;

create or replace function public.report_client_error(p_kind text, p_message text, p_route text default null,
  p_detail text default null, p_user_agent text default null, p_app_version text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if p_kind not in ('error', 'feedback') or coalesce(trim(p_message), '') = '' then return; end if;
  -- limite: 40 por pessoa a cada 10 min (sem login: 300 no total a cada 10 min)
  if uid is not null then
    if (select count(*) from client_errors where user_id = uid and created_at > now() - interval '10 minutes') >= 40 then return; end if;
  elsif (select count(*) from client_errors where user_id is null and created_at > now() - interval '10 minutes') >= 300 then
    return;
  end if;
  insert into client_errors (user_id, kind, route, message, detail, user_agent, app_version)
  values (case when exists (select 1 from profiles where id = uid) then uid end, p_kind,
          left(p_route, 200), left(trim(p_message), 2000), left(p_detail, 4000), left(p_user_agent, 300), left(p_app_version, 40));
end $$;
revoke execute on function public.report_client_error(text, text, text, text, text, text) from public;
grant execute on function public.report_client_error(text, text, text, text, text, text) to anon, authenticated;

-- mantém só 30 dias
create or replace function public.purge_client_errors()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from client_errors where created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_client_errors() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'fomo_purge_client_errors') then
      perform cron.unschedule('fomo_purge_client_errors');
    end if;
    perform cron.schedule('fomo_purge_client_errors', '23 6 * * *', 'select public.purge_client_errors();');
  end if;
end $$;
