-- "Sua noite tá pronta": no dia seguinte a uma noite com posts, avisa a pessoa (uma vez por dia).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'like', 'comment', 'achievement', 'event_approved', 'moderation',
  'message', 'group_invite', 'group_response', 'event_reminder', 'group_poll', 'arrived_home', 'story_like',
  'night_recap'));

-- Noite = de ontem 12h até hoje 6h (horário de São Paulo). Roda ao meio-dia.
create or replace function public.send_night_recaps()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_from timestamptz := ((v_today - 1)::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo';
  v_to timestamptz := (v_today::timestamp + interval '6 hours') at time zone 'America/Sao_Paulo';
  v_n integer;
begin
  insert into notifications (user_id, type, entity_type)
  select distinct p.author_id, 'night_recap', 'recap'
  from posts p
  join profiles pr on pr.id = p.author_id and not coalesce(pr.is_demo, false)
  where p.created_at >= v_from and p.created_at < v_to
    and p.moderation_status = 'visible'
    and not exists (
      select 1 from notifications n
      where n.user_id = p.author_id and n.type = 'night_recap'
        and n.created_at >= (v_today::timestamp at time zone 'America/Sao_Paulo'));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.send_night_recaps() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('fomo_night_recaps') where exists (select 1 from cron.job where jobname = 'fomo_night_recaps');
    perform cron.schedule('fomo_night_recaps', '0 15 * * *', 'select public.send_night_recaps();');
  end if;
end $$;
