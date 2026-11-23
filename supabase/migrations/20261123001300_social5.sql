-- ============================================================================
-- FOMO · 0013 · Social 5 — segurança na saída do rolê
--  1) localização ao vivo SÓ com o grupo, por tempo limitado (some sozinha)
--  2) modo discreto: todo check-in vira anônimo e stories não marcam o rolê
--     (garantido no servidor, não só na tela)
-- ============================================================================

-- 1) ----------------------------------------------------------------- localização com o grupo
create table if not exists public.group_locations (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m int check (accuracy_m is null or accuracy_m between 0 and 100000),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (group_id, user_id)
);
create index if not exists group_locations_user_idx on public.group_locations (user_id);
alter table public.group_locations enable row level security;

-- quem confirmou (vou/talvez) vê a localização de quem compartilhou, enquanto não vence
create or replace function private.is_group_active_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid() and status in ('going', 'maybe'));
$$;
revoke execute on function private.is_group_active_member(uuid) from public;
grant execute on function private.is_group_active_member(uuid) to authenticated;

create policy group_locations_select on public.group_locations for select to authenticated
  using (user_id = (select auth.uid())
         or (expires_at > now() and private.is_group_active_member(group_id)
             and exists (select 1 from group_members gm where gm.group_id = group_locations.group_id
                         and gm.user_id = group_locations.user_id and gm.status in ('going', 'maybe'))));
create policy group_locations_delete on public.group_locations for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.group_locations from anon, authenticated;
grant delete on public.group_locations to authenticated;

-- começa/atualiza o compartilhamento. p_minutes só vale na primeira vez (não dá para "esticar" sem querer):
-- ao atualizar a posição, mantém o prazo já escolhido.
create or replace function public.share_group_location(p_group uuid, p_lat double precision, p_lng double precision,
  p_accuracy int default null, p_minutes int default null)
returns timestamptz language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); exp timestamptz;
begin
  if not private.is_group_active_member(p_group) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_minutes is not null and p_minutes not between 15 and 240 then raise exception 'invalid_duration' using errcode = '22023'; end if;
  select expires_at into exp from group_locations where group_id = p_group and user_id = uid and expires_at > now();
  if exp is null and p_minutes is null then raise exception 'not_sharing' using errcode = '22023'; end if;
  if p_minutes is not null then exp := now() + make_interval(mins => p_minutes); end if;
  insert into group_locations (group_id, user_id, latitude, longitude, accuracy_m, updated_at, expires_at)
  values (p_group, uid, p_lat, p_lng, p_accuracy, now(), exp)
  on conflict (group_id, user_id) do update set latitude = excluded.latitude, longitude = excluded.longitude,
    accuracy_m = excluded.accuracy_m, updated_at = now(), expires_at = excluded.expires_at;
  return exp;
end $$;
revoke execute on function public.share_group_location(uuid, double precision, double precision, int, int) from public, anon;
grant execute on function public.share_group_location(uuid, double precision, double precision, int, int) to authenticated;

create or replace function public.group_locations_json(p_group uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_agg(jsonb_build_object('profile', to_jsonb(p), 'latitude', l.latitude, 'longitude', l.longitude,
      'accuracyM', l.accuracy_m, 'updatedAt', l.updated_at, 'expiresAt', l.expires_at) order by l.updated_at desc), '[]'::jsonb)
  from group_locations l join profiles p on p.id = l.user_id
  where l.group_id = p_group and l.expires_at > now()
    and (l.user_id = auth.uid() or (private.is_group_active_member(p_group)
         and exists (select 1 from group_members gm where gm.group_id = p_group and gm.user_id = l.user_id and gm.status in ('going', 'maybe'))));
$$;
revoke execute on function public.group_locations_json(uuid) from public, anon;
grant execute on function public.group_locations_json(uuid) to authenticated;

-- quem sai do grupo (ou recusa) para de compartilhar na hora
create or replace function public.group_members_stop_location()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from group_locations where group_id = old.group_id and user_id = old.user_id;
    return old;
  end if;
  if new.status not in ('going', 'maybe') then
    delete from group_locations where group_id = new.group_id and user_id = new.user_id;
  end if;
  return new;
end $$;
revoke execute on function public.group_members_stop_location() from public, anon, authenticated;
drop trigger if exists group_members_stop_location on public.group_members;
create trigger group_members_stop_location after update of status or delete on public.group_members
  for each row execute function public.group_members_stop_location();

create or replace function public.purge_group_locations()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from group_locations where expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_group_locations() from public, anon, authenticated;

-- 2) ----------------------------------------------------------------- modo discreto
alter table public.profiles add column if not exists discreet_mode boolean not null default false;

create or replace function public.set_discreet_mode(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update profiles set discreet_mode = p_on,
    default_checkin_visibility = case when p_on then 'private' else default_checkin_visibility end
  where id = uid;
  if p_on then
    -- o que já estava visível nas últimas 24 h também some na hora
    update check_ins set visibility = 'private' where user_id = uid and created_at > now() - interval '24 hours';
    update stories set event_id = null where author_id = uid and expires_at > now();
    delete from group_locations where user_id = uid;
  end if;
end $$;
revoke execute on function public.set_discreet_mode(boolean) from public, anon;
grant execute on function public.set_discreet_mode(boolean) to authenticated;

-- check-in: no modo discreto, sempre anônimo (vale também se o app pedir outra coisa)
create or replace function public.check_in(p_event_id uuid, p_visibility text, p_reveal_minutes int default 0)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); e events; vis text := p_visibility;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = uid) then raise exception 'profile_required' using errcode = '42501'; end if;
  if p_visibility not in ('public', 'friends', 'followers', 'private') then raise exception 'invalid_visibility' using errcode = '22023'; end if;
  if coalesce(p_reveal_minutes, 0) not between 0 and 1440 then raise exception 'invalid_reveal' using errcode = '22023'; end if;
  if (select discreet_mode from profiles where id = uid) then vis := 'private'; end if;
  select * into e from events where id = p_event_id and status in ('approved', 'ended');
  if not found then raise exception 'event_not_available' using errcode = '22023'; end if;
  if now() < e.starts_at - interval '3 hours'
     or now() > coalesce(e.ends_at, e.starts_at + interval '10 hours') + interval '2 hours' then
    raise exception 'checkin_closed' using errcode = '22023';
  end if;
  -- limite só para check-ins NOVOS (editar o próprio check-in não conta)
  if not exists (select 1 from check_ins where user_id = uid and event_id = p_event_id)
     and (select count(*) from check_ins where user_id = uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into check_ins (user_id, event_id, status, visibility, reveal_at)
  values (uid, p_event_id, 'declared', vis,
          case when coalesce(p_reveal_minutes, 0) > 0 and vis <> 'private' then now() + make_interval(mins => p_reveal_minutes) end)
  on conflict (user_id, event_id) where event_id is not null
  do update set visibility = excluded.visibility, reveal_at = excluded.reveal_at;
  return public.event_presence(p_event_id);
end $$;
revoke execute on function public.check_in(uuid, text, int) from public, anon;
grant execute on function public.check_in(uuid, text, int) to authenticated;

-- o cliente não muda a própria visibilidade de check-in para fora do anônimo no modo discreto
create or replace function public.check_ins_discreet_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visibility <> 'private' and (select discreet_mode from profiles where id = new.user_id) then
    new.visibility := 'private';
  end if;
  return new;
end $$;
revoke execute on function public.check_ins_discreet_guard() from public, anon, authenticated;
drop trigger if exists check_ins_discreet_guard on public.check_ins;
create trigger check_ins_discreet_guard before insert or update of visibility on public.check_ins
  for each row execute function public.check_ins_discreet_guard();

-- story: no modo discreto não marca o rolê
create or replace function public.stories_discreet_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.event_id is not null and (select discreet_mode from profiles where id = new.author_id) then
    new.event_id := null;
  end if;
  return new;
end $$;
revoke execute on function public.stories_discreet_guard() from public, anon, authenticated;
drop trigger if exists stories_discreet_guard on public.stories;
create trigger stories_discreet_guard before insert on public.stories
  for each row execute function public.stories_discreet_guard();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'fomo_purge_group_locations') then
      perform cron.unschedule('fomo_purge_group_locations');
    end if;
    perform cron.schedule('fomo_purge_group_locations', '*/30 * * * *', 'select public.purge_group_locations();');
  end if;
end $$;
