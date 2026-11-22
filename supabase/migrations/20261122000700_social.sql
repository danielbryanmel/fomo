-- ============================================================================
-- FOMO · 0007 · Social (Fase 6 — telas)
--  1) submit_live_report devolve o XP da presença confirmada (UI não chuta valor)
--  2) avatar_url só aceita arquivo do próprio usuário no bucket público `avatars`
--  3) responder solicitação de seguir limpa a notificação correspondente
--  4) limite de sugestões de rolê (anti-spam na fila de moderação)
-- ============================================================================

-- 1) ---------------------------------------------------------------------------
create or replace function public.submit_live_report(
  p_event_id uuid, p_crowd smallint, p_vibe text, p_music text, p_queue text, p_lat double precision, p_lng double precision)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  uid uuid := auth.uid();
  e events;
  cfg live_config;
  d double precision;
  rid uuid;
  ci uuid;
  xp int;
  pxp int;
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

  insert into check_ins (user_id, event_id, status, verification_method, visibility, verified_at)
  values (uid, p_event_id, 'verified', 'one_time_location', (select default_checkin_visibility from profiles where id = uid), now())
  on conflict (user_id, event_id) where event_id is not null
  do update set status = 'verified', verification_method = 'one_time_location', verified_at = coalesce(check_ins.verified_at, now())
  returning id into ci;
  pxp := award_xp(uid, 'verified_checkin', 'check_in', ci);

  xp := award_xp(uid, 'live_report', 'live_report', rid);
  return jsonb_build_object('accepted', true, 'xpPending', xp, 'presenceVerified', true, 'presenceXp', pxp,
    'expiresAt', now() + make_interval(mins => cfg.report_ttl_min));
end $$;
revoke execute on function public.submit_live_report(uuid, smallint, text, text, text, double precision, double precision) from public, anon;
grant execute on function public.submit_live_report(uuid, smallint, text, text, text, double precision, double precision) to authenticated;

-- 2) ---------------------------------------------------------------------------
create or replace function public.profiles_avatar_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.avatar_url is not null and (
       new.avatar_url !~ '^https://'
    or position('/storage/v1/object/public/avatars/' || new.id::text || '/' in new.avatar_url) = 0
  ) then
    raise exception 'invalid_avatar' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function public.profiles_avatar_guard() from public, anon, authenticated;
drop trigger if exists profiles_avatar on public.profiles;
create trigger profiles_avatar before insert or update of avatar_url on public.profiles
  for each row execute function public.profiles_avatar_guard();

-- 3) ---------------------------------------------------------------------------
create or replace function public.follows_clear_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and (tg_op = 'DELETE' or new.status = 'accepted') then
    delete from notifications where user_id = old.followee_id and actor_id = old.follower_id and type = 'follow_request';
  end if;
  return null;
end $$;
revoke execute on function public.follows_clear_request() from public, anon, authenticated;
drop trigger if exists follows_clear_request on public.follows;
create trigger follows_clear_request after update or delete on public.follows
  for each row execute function public.follows_clear_request();

-- 4) ---------------------------------------------------------------------------
create or replace function public.events_submit_guard()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  -- só limita sugestões feitas por usuários (moderador / service_role ficam de fora)
  if auth.uid() is not null and not private.is_moderator() then
    if (select count(*) from events where created_by = auth.uid() and created_at > now() - interval '24 hours') >= 5 then
      raise exception 'rate_limited' using errcode = '54000';
    end if;
    if new.starts_at < now() - interval '6 hours' then
      raise exception 'event_in_past' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.events_submit_guard() from public, anon, authenticated;
drop trigger if exists events_submit on public.events;
create trigger events_submit before insert on public.events
  for each row execute function public.events_submit_guard();
