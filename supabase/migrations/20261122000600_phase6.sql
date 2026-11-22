-- ============================================================================
-- FOMO · 0006 · Fase 6 + performance
--  1) RLS: auth.uid() avaliado uma vez por consulta (Performance Advisor)
--  2) índices de FKs usadas em junções/exclusões
--  3) relato ao vivo aceito ⇒ presença CONFIRMADA (one_time_location) + XP
--  4) moderação de eventos (moderate_event) + notificação + XP ao criador
--  5) conquistas automáticas (primeiro rolê com foto, primeiro relato confirmado)
--  6) realtime de notificações
-- ============================================================================

-- 1) Reescreve políticas: auth.uid() → (select auth.uid())  [initplan]
do $$
declare
  p record;
  q text;
  c text;
begin
  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    q := replace(p.qual, 'auth.uid()', '( SELECT auth.uid() AS uid)');
    c := replace(p.with_check, 'auth.uid()', '( SELECT auth.uid() AS uid)');
    if q is distinct from p.qual and c is distinct from p.with_check and c is not null and q is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, q, c);
    elsif q is distinct from p.qual and q is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, q);
    elsif c is distinct from p.with_check and c is not null then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, c);
    end if;
  end loop;
end $$;

-- 2) Índices de FKs relevantes
create index if not exists check_ins_event_idx on public.check_ins (event_id);
create index if not exists comments_author_idx on public.comments (author_id);
create index if not exists comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index if not exists posts_check_in_idx on public.posts (check_in_id) where check_in_id is not null;
create index if not exists posts_category_idx on public.posts (category_id) where category_id is not null;
create index if not exists saved_events_event_idx on public.saved_events (event_id);
create index if not exists saved_posts_post_idx on public.saved_posts (post_id);
create index if not exists review_votes_voter_idx on public.review_votes (voter_id);
create index if not exists notifications_actor_idx on public.notifications (actor_id);
create index if not exists events_pending_idx on public.events (created_at) where status = 'pending';

-- Regras de XP novas
insert into public.xp_rules (key, description, amount, daily_cap, cooldown_seconds, requires_review) values
  ('event_approved', 'Evento divulgado e aprovado pela moderação', 25, 3, 0, false)
on conflict (key) do nothing;

-- 5) Conquistas
create or replace function public.grant_achievement(p_user uuid, p_key text)
returns void language plpgsql security definer set search_path = public, private as $$
declare a uuid;
begin
  select id into a from achievements where key = p_key and active;
  if a is null then return; end if;
  insert into user_achievements (user_id, achievement_id) values (p_user, a) on conflict do nothing;
  if found then
    insert into notifications (user_id, type, entity_type, entity_id) values (p_user, 'achievement', 'achievement', a);
  end if;
end $$;
revoke execute on function public.grant_achievement(uuid, text) from public, anon, authenticated;

create or replace function public.posts_achievements()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.media_count > 0 then perform grant_achievement(new.author_id, 'first_post'); end if;
  if (select count(distinct coalesce(p.category_id, e.category_id)) from posts p left join events e on e.id = p.event_id
      where p.author_id = new.author_id and p.moderation_status = 'visible') >= 5 then
    perform grant_achievement(new.author_id, 'explorer_5');
  end if;
  return null;
end $$;
revoke execute on function public.posts_achievements() from public, anon, authenticated;
create trigger posts_achievements after insert on public.posts for each row execute function public.posts_achievements();

create or replace function public.xp_achievements()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.rule_key = 'live_report' and new.status = 'granted' then
    perform grant_achievement(new.user_id, 'first_report');
  end if;
  return null;
end $$;
revoke execute on function public.xp_achievements() from public, anon, authenticated;
create trigger xp_achievements after insert or update of status on public.user_xp_transactions
  for each row execute function public.xp_achievements();

-- 3) Relato aceito confirma presença (a localização já foi validada no servidor)
create or replace function public.submit_live_report(
  p_event_id uuid, p_crowd smallint, p_vibe text, p_music text, p_queue text,
  p_lat double precision, p_lng double precision
)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  uid uuid := auth.uid();
  e events;
  cfg live_config;
  d double precision;
  rid uuid;
  ci uuid;
  xp int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = uid) then raise exception 'profile_required' using errcode = '42501'; end if;
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

  insert into live_reports (user_id, event_id, crowd, vibe, music, queue)
  values (uid, p_event_id, p_crowd, p_vibe, p_music, p_queue)
  returning id into rid;

  -- presença confirmada por leitura única de localização (visibilidade = padrão do usuário)
  insert into check_ins (user_id, event_id, status, verification_method, visibility, verified_at)
  values (uid, p_event_id, 'verified', 'one_time_location', (select default_checkin_visibility from profiles where id = uid), now())
  on conflict (user_id, event_id) where event_id is not null
  do update set status = 'verified', verification_method = 'one_time_location', verified_at = coalesce(check_ins.verified_at, now())
  returning id into ci;
  perform award_xp(uid, 'verified_checkin', 'check_in', ci);

  xp := award_xp(uid, 'live_report', 'live_report', rid);
  return jsonb_build_object('accepted', true, 'xpPending', xp, 'presenceVerified', true,
    'expiresAt', now() + make_interval(mins => cfg.report_ttl_min));
end $$;
revoke execute on function public.submit_live_report(uuid, smallint, text, text, text, double precision, double precision) from public, anon;
grant execute on function public.submit_live_report(uuid, smallint, text, text, text, double precision, double precision) to authenticated;

-- 4) Moderação de eventos
create or replace function public.moderate_event(p_event_id uuid, p_approve boolean)
returns public.events language plpgsql security definer set search_path = public, private as $$
declare e events;
begin
  if not private.is_moderator() then raise exception 'forbidden' using errcode = '42501'; end if;
  update events set status = case when p_approve then 'approved' else 'cancelled' end,
                    moderated_by = auth.uid(), moderated_at = now()
  where id = p_event_id and status = 'pending'
  returning * into e;
  if not found then raise exception 'not_pending' using errcode = '22023'; end if;
  if p_approve then
    perform award_xp(e.created_by, 'event_approved', 'event', e.id);
    insert into notifications (user_id, type, actor_id, entity_type, entity_id)
    values (e.created_by, 'event_approved', auth.uid(), 'event', e.id);
  else
    insert into notifications (user_id, type, actor_id, entity_type, entity_id)
    values (e.created_by, 'moderation', auth.uid(), 'event', e.id);
  end if;
  return e;
end $$;
revoke execute on function public.moderate_event(uuid, boolean) from public, anon;
grant execute on function public.moderate_event(uuid, boolean) to authenticated;

-- 6) Realtime de notificações (o app escuta só as próprias; RLS se aplica)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;
