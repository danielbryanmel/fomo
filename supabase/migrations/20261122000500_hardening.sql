-- ============================================================================
-- FOMO · 0005 · Endurecimento (achado pelo Security Advisor do Supabase)
-- No Supabase, funções novas recebem EXECUTE para PUBLIC. Então:
--  1) helpers de autorização vão para o schema `private` (fora da API REST).
--     ALTER ... SET SCHEMA preserva o OID → as políticas RLS continuam válidas.
--  2) funções de trigger/internas: sem EXECUTE para PUBLIC/anon/authenticated.
--  3) RPCs do app: só `authenticated`.
--  4) profile_relationship(): substitui chamadas diretas a helpers pelo cliente.
-- ============================================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.is_blocked(uuid, uuid) set schema private;
alter function public.follow_status(uuid, uuid) set schema private;
alter function public.can_view_profile_content(uuid, uuid) set schema private;
alter function public.can_view_item(uuid, uuid, text) set schema private;
alter function public.is_moderator() set schema private;

-- helpers: avaliados dentro das políticas RLS (precisam de EXECUTE), mas não expostos via API
do $$
declare f text;
begin
  foreach f in array array[
    'private.is_blocked(uuid, uuid)', 'private.follow_status(uuid, uuid)',
    'private.can_view_profile_content(uuid, uuid)', 'private.can_view_item(uuid, uuid, text)', 'private.is_moderator()'
  ] loop
    execute format('alter function %s set search_path = public, private', f);
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;

-- funções que chamam os helpers sem qualificar o schema
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_post(uuid, text, jsonb, uuid, text, date, uuid, smallint, text, boolean)',
    'public.events_in_bounds(double precision, double precision, double precision, double precision, double precision, double precision, text, text, double precision, text, text, integer)',
    'public.feed(text, text, integer)', 'public.live_status(uuid)',
    'public.submit_live_report(uuid, smallint, text, text, text, double precision, double precision)',
    'public.claim_profile(text, text)', 'public.follows_before_insert()', 'public.follows_counters()',
    'public.blocks_after_insert()', 'public.profiles_privacy_change()', 'public.posts_after_change()',
    'public.likes_counter()', 'public.comments_counter()', 'public.reviews_counter()', 'public.review_votes_counter()',
    'public.xp_tx_sync()', 'public.award_xp(uuid, text, text, uuid)', 'public.confirm_pending_live_xp()',
    'public.end_past_events()', 'public.recompute_credibility(uuid)'
  ] loop
    execute format('alter function %s set search_path = public, private', f);
  end loop;
end $$;

-- triggers e internas: ninguém chama pela API
do $$
declare f text;
begin
  foreach f in array array[
    'public.follows_before_insert()', 'public.follows_before_update()', 'public.follows_counters()',
    'public.blocks_after_insert()', 'public.profiles_privacy_change()', 'public.posts_after_change()',
    'public.likes_counter()', 'public.comments_counter()', 'public.reviews_counter()', 'public.review_votes_counter()',
    'public.xp_tx_sync()', 'public.touch_updated_at()', 'public.award_xp(uuid, text, text, uuid)',
    'public.confirm_pending_live_xp()', 'public.end_past_events()', 'public.recompute_credibility(uuid)',
    'public.level_for_xp(integer)', 'public.haversine_m(double precision, double precision, double precision, double precision)',
    'public.is_happening_now(public.events, timestamptz)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- RPCs do app: só usuário logado
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_post(uuid, text, jsonb, uuid, text, date, uuid, smallint, text, boolean)',
    'public.events_in_bounds(double precision, double precision, double precision, double precision, double precision, double precision, text, text, double precision, text, text, integer)',
    'public.feed(text, text, integer)', 'public.live_status(uuid)',
    'public.submit_live_report(uuid, smallint, text, text, text, double precision, double precision)',
    'public.claim_profile(text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Relação do usuário logado com um perfil (sem expor relações entre terceiros)
create or replace function public.profile_relationship(p_target uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'isSelf', auth.uid() = p_target,
    'followStatus', private.follow_status(auth.uid(), p_target),
    'followsViewer', private.follow_status(p_target, auth.uid()) = 'accepted',
    'isBlocked', exists (select 1 from blocks where blocker_id = auth.uid() and blocked_id = p_target),
    'canViewContent', private.can_view_profile_content(auth.uid(), p_target)
  );
$$;
revoke execute on function public.profile_relationship(uuid) from public, anon;
grant execute on function public.profile_relationship(uuid) to authenticated;
