-- ============================================================================
-- FOMO · 0003 · Row Level Security em TODAS as tabelas
-- Princípio: sem política = sem acesso. Escritas sensíveis só via RPC security definer.
-- Além da RLS, privilégios por COLUNA impedem o cliente de alterar contadores, XP,
-- credibilidade, status de moderação etc.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','follows','blocks','event_categories','events','check_ins','posts','post_media',
    'reviews','review_votes','likes','comments','saved_events','saved_posts','live_config','live_reports',
    'level_definitions','xp_rules','user_xp_transactions','achievements','user_achievements',
    'credibility_snapshots','reports','notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Funções security definer rodam como o owner das tabelas (postgres), que ignora RLS
-- por padrão (sem FORCE). O cliente (anon/authenticated) nunca é owner.

-- ─────────────────────────── Privilégios por coluna ───────────────────────────
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, bio, city, is_private, default_checkin_visibility) on public.profiles to authenticated;

revoke update on public.follows from anon, authenticated;
grant update (status) on public.follows to authenticated;

revoke insert, update on public.posts from anon, authenticated;
grant update (body, place_name, experience_date, category_id, rating, visibility) on public.posts to authenticated;

revoke insert, update, delete on public.post_media from anon, authenticated;

revoke update on public.check_ins from anon, authenticated;
grant update (visibility) on public.check_ins to authenticated;

revoke update on public.reviews from anon, authenticated;
grant update (rating, body) on public.reviews to authenticated;

revoke update on public.comments from anon, authenticated;
grant update (body) on public.comments to authenticated;

revoke update on public.events from anon, authenticated;
grant update (title, description, category_id, starts_at, ends_at, venue_name, address, latitude, longitude,
              price_min_cents, price_max_cents, ticket_url, cover_path) on public.events to authenticated;

revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke insert, update, delete on public.live_reports, public.user_xp_transactions, public.user_achievements,
  public.credibility_snapshots, public.live_config, public.level_definitions, public.xp_rules, public.achievements,
  public.event_categories from anon, authenticated;

-- Escrita de anon: nenhuma
revoke insert, update, delete on all tables in schema public from anon;

-- RPCs: só usuários autenticados
revoke execute on function public.create_post(uuid, text, jsonb, uuid, text, date, uuid, smallint, text, boolean) from anon;
revoke execute on function public.submit_live_report(uuid, smallint, text, text, text, double precision, double precision) from anon;
revoke execute on function public.claim_profile(text, text) from anon;

-- ─────────────────────────── Perfis ───────────────────────────
create policy profiles_select on public.profiles for select to anon, authenticated
  using (not is_blocked(auth.uid(), id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ─────────────────────────── Follows / blocks ───────────────────────────
create policy follows_select on public.follows for select to anon, authenticated
  using (
    auth.uid() in (follower_id, followee_id)
    or (status = 'accepted' and can_view_profile_content(auth.uid(), followee_id) and can_view_profile_content(auth.uid(), follower_id))
  );
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = auth.uid());
create policy follows_accept on public.follows for update to authenticated
  using (followee_id = auth.uid()) with check (followee_id = auth.uid());
create policy follows_delete on public.follows for delete to authenticated
  using (auth.uid() in (follower_id, followee_id));

create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- ─────────────────────────── Catálogos (leitura pública) ───────────────────────────
create policy categories_read on public.event_categories for select to anon, authenticated using (true);
create policy live_config_read on public.live_config for select to anon, authenticated using (true);
create policy levels_read on public.level_definitions for select to anon, authenticated using (true);
create policy xp_rules_read on public.xp_rules for select to anon, authenticated using (true);
create policy achievements_read on public.achievements for select to anon, authenticated using (active);

-- ─────────────────────────── Eventos ───────────────────────────
create policy events_select on public.events for select to anon, authenticated
  using (status in ('approved', 'ended', 'cancelled') or created_by = auth.uid() or is_moderator());
-- usuário cria sempre como pendente e sem patrocínio
create policy events_insert on public.events for insert to authenticated
  with check (created_by = auth.uid() and status = 'pending' and not is_sponsored and sponsored_until is null and moderated_by is null);
-- criador edita só enquanto pendente; moderador edita sempre
create policy events_update on public.events for update to authenticated
  using ((created_by = auth.uid() and status = 'pending') or is_moderator())
  with check ((created_by = auth.uid() and status = 'pending') or is_moderator());
create policy events_delete on public.events for delete to authenticated
  using ((created_by = auth.uid() and status = 'pending') or is_moderator());

-- ─────────────────────────── Presença ───────────────────────────
create policy check_ins_select on public.check_ins for select to anon, authenticated
  using (can_view_item(auth.uid(), user_id, visibility));
-- cliente só DECLARA presença; verificação é exclusiva do servidor
create policy check_ins_insert on public.check_ins for insert to authenticated
  with check (user_id = auth.uid() and status = 'declared' and verification_method is null and verified_at is null);
create policy check_ins_update on public.check_ins for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy check_ins_delete on public.check_ins for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────── Posts e mídia ───────────────────────────
create policy posts_select on public.posts for select to anon, authenticated
  using (author_id = auth.uid() or (moderation_status = 'visible' and can_view_item(auth.uid(), author_id, visibility)));
-- insert só via create_post()
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = auth.uid() or is_moderator());

create policy post_media_select on public.post_media for select to anon, authenticated
  using (exists (
    select 1 from posts p where p.id = post_id
      and (p.author_id = auth.uid() or (p.moderation_status = 'visible' and can_view_item(auth.uid(), p.author_id, p.visibility)))
  ));

-- ─────────────────────────── Avaliações ───────────────────────────
create policy reviews_select on public.reviews for select to anon, authenticated
  using (author_id = auth.uid() or (moderation_status = 'visible' and not is_blocked(auth.uid(), author_id)));
create policy reviews_insert on public.reviews for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from events e where e.id = event_id and e.status in ('approved', 'ended')));
create policy reviews_update on public.reviews for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy reviews_delete on public.reviews for delete to authenticated
  using (author_id = auth.uid() or is_moderator());

create policy review_votes_own on public.review_votes for all to authenticated
  using (voter_id = auth.uid()) with check (voter_id = auth.uid());

-- ─────────────────────────── Curtidas e comentários ───────────────────────────
create policy likes_select on public.likes for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from posts p where p.id = post_id and can_view_item(auth.uid(), p.author_id, p.visibility)));
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from posts p where p.id = post_id and p.moderation_status = 'visible' and can_view_item(auth.uid(), p.author_id, p.visibility)));
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

create policy comments_select on public.comments for select to anon, authenticated
  using (
    (author_id = auth.uid() or (moderation_status = 'visible' and not is_blocked(auth.uid(), author_id)))
    and exists (select 1 from posts p where p.id = post_id and can_view_item(auth.uid(), p.author_id, p.visibility))
  );
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and exists (
    select 1 from posts p where p.id = post_id and p.moderation_status = 'visible'
      and can_view_item(auth.uid(), p.author_id, p.visibility) and not is_blocked(auth.uid(), p.author_id)));
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from posts p where p.id = post_id and p.author_id = auth.uid()) or is_moderator());

-- ─────────────────────────── Salvos (privados) ───────────────────────────
create policy saved_events_own on public.saved_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_posts_own on public.saved_posts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid()
    and exists (select 1 from posts p where p.id = post_id and can_view_item(auth.uid(), p.author_id, p.visibility)));

-- ─────────────────────────── Ao vivo ───────────────────────────
-- live_reports: SEM política para o cliente → ninguém lê linhas individuais.
-- Leitura só agregada via live_status(); escrita só via submit_live_report().

-- ─────────────────────────── Gamificação ───────────────────────────
create policy xp_tx_own on public.user_xp_transactions for select to authenticated using (user_id = auth.uid());
create policy user_achievements_read on public.user_achievements for select to anon, authenticated
  using (can_view_profile_content(auth.uid(), user_id));
create policy credibility_read on public.credibility_snapshots for select to anon, authenticated
  using (user_id = auth.uid() or can_view_profile_content(auth.uid(), user_id));

-- ─────────────────────────── Moderação e avisos ───────────────────────────
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and handled_by is null);
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or is_moderator());
create policy reports_moderate on public.reports for update to authenticated
  using (is_moderator()) with check (is_moderator());
revoke update on public.reports from anon, authenticated;
grant update (status, handled_by, handled_at) on public.reports to authenticated;

create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
