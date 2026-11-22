-- Agendamentos (rodar UMA vez após habilitar a extensão pg_cron no projeto Supabase:
-- Dashboard → Database → Extensions → pg_cron). Não faz parte das migrations porque
-- depende da extensão estar disponível.
select cron.schedule('fomo_end_past_events', '*/10 * * * *', $$ select public.end_past_events(); $$);
select cron.schedule('fomo_confirm_live_xp', '*/15 * * * *', $$ select public.confirm_pending_live_xp(); $$);
-- credibilidade: recalcula diariamente quem teve atividade nas últimas 24 h
select cron.schedule('fomo_credibility', '17 4 * * *', $$
  select public.recompute_credibility(id) from public.profiles
  where id in (select author_id from public.posts where created_at > now() - interval '1 day'
               union select author_id from public.reviews where updated_at > now() - interval '1 day');
$$);
