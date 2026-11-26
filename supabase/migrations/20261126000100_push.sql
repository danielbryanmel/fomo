-- Notificações push (Web Push / PWA) + "cutucadas" de fim de semana.
-- Fluxo: notifications (insert) → push_queue → cron chama a Edge Function push-dispatch → Web Push.
-- O cliente só cadastra/remove a própria inscrição; nunca lê a fila nem as inscrições dos outros.
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net indisponível'; end $$;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  failures int not null default 0
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subs_own_read on public.push_subscriptions;
create policy push_subs_own_read on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select (id, endpoint, created_at) on public.push_subscriptions to authenticated;

create table if not exists public.push_queue (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 240),
  url text not null default '/' check (url ~ '^/'),
  tag text check (char_length(tag) <= 80),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts int not null default 0,
  image text check (image ~ '^/push/[a-z0-9-]+\.png$'),
  copy_id int
);
create index if not exists push_queue_pending_idx on public.push_queue (id) where sent_at is null;
alter table public.push_queue enable row level security;
revoke all on public.push_queue from anon, authenticated;

alter table public.profiles add column if not exists push_nudges boolean not null default true;
-- opcional: só usado para escolher o texto certo das cutucadas ("sua namorada" / "seu namorado")
alter table public.profiles add column if not exists pronoun text check (pronoun in ('ele', 'ela'));

-- Catálogo das cutucadas: editável por SQL, sem deploy. {n} = rolês rolando agora.
-- dow: 4 qui, 5 sex, 6 sáb (null = qualquer dia). audience: all | ele | ela | unset (sem pronome).
create table if not exists public.push_copy (
  id serial primary key,
  dow int check (dow between 1 and 7),
  audience text not null default 'all' check (audience in ('all', 'ele', 'ela', 'unset')),
  title text not null check (char_length(title) <= 80),
  body text not null check (char_length(body) <= 160),
  image text not null default '/push/sai-de-casa.png' check (image ~ '^/push/[a-z0-9-]+\.png$'),
  active boolean not null default true
);
alter table public.push_copy enable row level security;
revoke all on public.push_copy from anon, authenticated;
insert into public.push_copy (dow, audience, title, body, image)
select * from (values
  (4, 'all', 'Quinta é a nova sexta', '{n} rolês rolando agora. Ninguém precisa saber que amanhã é dia útil.', '/push/sai-de-casa.png'),
  (4, 'all', 'Quinta sem rolê é quarta', 'Tem {n} rolês acontecendo agora. Abre e escolhe um.', '/push/sai-de-casa.png'),
  (4, 'all', 'Vai mesmo dormir cedo?', 'Seu despertador pode esperar. {n} rolês rolando agora.', '/push/sai-de-casa.png'),
  (5, 'all', 'Sextou e você no sofá?', '{n} rolês rolando agora. O FOMO é real.', '/push/sofa.png'),
  (5, 'all', 'Sexta em casa? Sério?', 'Tem {n} lugares com gente agora. Depois não diz que não avisamos.', '/push/sai-de-casa.png'),
  (5, 'all', 'A semana acabou. Você vai sair?', '{n} rolês rolando agora. Escolhe um e vai.', '/push/sai-de-casa.png'),
  (6, 'all', 'Como assim é sábado e você vai ficar em casa?', '{n} rolês rolando agora. Bora?', '/push/sabado.png'),
  (6, 'all', 'Sábado à noite e você aqui no celular?', 'Pelo menos usa ele pra achar um rolê: {n} rolando agora.', '/push/sabado.png'),
  (6, 'all', 'O sofá aguenta sem você hoje', 'Prometemos. Tem {n} rolês te esperando.', '/push/sofa.png'),
  (null, 'all', 'Sua vida social pediu socorro', 'Estamos tentando ajudar: {n} rolês rolando agora.', '/push/socorro.png'),
  (null, 'all', 'Não queremos pressionar…', 'Mas até sua cadeira está cansada de você.', '/push/sofa.png'),
  (null, 'all', 'Você já virou parte do sofá', 'Levanta devagar. Tem {n} rolês te esperando.', '/push/sofa.png'),
  (null, 'all', 'Tá trancando?', 'Ou tá duro torcendo pra chover? Abre o mapa e acha um rolê que cabe no bolso.', '/push/sai-de-casa.png'),
  (null, 'all', 'Alerta de FOMO', 'Seus amigos podem estar se divertindo agora. Sem você.', '/push/alerta.png'),
  (null, 'all', 'Pijama não é dress code', 'Troca de roupa: {n} rolês rolando agora.', '/push/sai-de-casa.png'),
  (null, 'all', 'A série pode esperar', 'O rolê de hoje não volta. {n} acontecendo agora.', '/push/sai-de-casa.png'),
  (null, 'all', 'Amanhã você vai ver os stories e se arrepender', 'Ou pode aparecer neles. {n} rolês agora.', '/push/alerta.png'),
  (null, 'all', 'Seu sofá pediu um tempo', 'Ele disse que precisa de espaço. Tem {n} rolês por aí.', '/push/sofa.png'),
  (null, 'ele', 'Sua namorada não quer que você saia', 'Mas seus amigos sim! {n} rolês rolando agora.', '/push/socorro.png'),
  (null, 'ela', 'Seu namorado não quer que você saia', 'Mas suas amigas sim! {n} rolês rolando agora.', '/push/socorro.png'),
  (null, 'unset', 'Seu mozão não quer que você saia', 'Mas o rolê quer! {n} rolando agora.', '/push/socorro.png')
) v where not exists (select 1 from public.push_copy);

create or replace function public.set_pronoun(p_pronoun text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_pronoun is not null and p_pronoun not in ('ele', 'ela') then raise exception 'invalid_pronoun' using errcode = '22023'; end if;
  update profiles set pronoun = p_pronoun where id = auth.uid();
end $$;
revoke all on function public.set_pronoun(text) from public, anon;
grant execute on function public.set_pronoun(text) to authenticated;

-- cadastro da inscrição (só endpoints dos serviços de push conhecidos)
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then
    raise exception 'invalid_endpoint' using errcode = '22023';
  end if;
  if (select count(*) from push_subscriptions where user_id = uid) >= 10 then
    delete from push_subscriptions where id = (select id from push_subscriptions where user_id = uid order by created_at limit 1);
  end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update set user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, failures = 0;
end $$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

create or replace function public.set_push_nudges(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update profiles set push_nudges = p_on where id = auth.uid();
end $$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.remove_push_subscription(text) from public, anon;
revoke all on function public.set_push_nudges(boolean) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
grant execute on function public.set_push_nudges(boolean) to authenticated;
grant select (push_nudges, pronoun) on public.profiles to authenticated;

-- toda notificação do app vira push (sem conteúdo de mensagem: só quem e o quê)
create or replace function private.enqueue_push_from_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text; t text; b text; u text := '/notifications'; img text; gname text;
begin
  if not exists (select 1 from push_subscriptions where user_id = new.user_id) then return new; end if;
  select '@' || username into who from profiles where id = new.actor_id;
  who := coalesce(who, 'Alguém');
  if new.entity_type = 'group' and new.entity_id is not null then
    select name into gname from groups where id = new.entity_id;
  end if;
  case new.type
    when 'message' then t := who; b := 'Te mandou uma mensagem. Abre aí.'; u := '/messages';
    when 'follow' then t := who || ' começou a te seguir'; b := 'Agora vocês podem combinar o próximo rolê.';
    when 'follow_request' then t := who || ' quer te seguir'; b := 'Aceita? Quanto mais gente, melhor o rolê.';
    when 'follow_accepted' then t := who || ' aceitou seu pedido'; b := 'Agora vocês acompanham os rolês um do outro.';
    when 'like' then t := who || ' curtiu sua publicação'; b := 'Tá fazendo sucesso por aí.';
    when 'comment' then t := who || ' comentou'; b := 'Tem comentário novo na sua publicação.';
    when 'story_like' then t := who || ' curtiu seu story'; b := 'Seu rolê tá rendendo.';
    when 'group_invite' then
      t := who || ' lembrou de você'; img := '/push/bora.png';
      b := 'Dessa vez não é cobrança: é convite' || coalesce(' pro "' || gname || '"', ' pra um rolê') || '. Bora?';
    when 'group_response' then t := coalesce(gname, 'Seu grupo'); b := who || ' respondeu ao convite.';
    when 'group_poll' then t := coalesce(gname, 'Enquete no grupo'); b := who || ' abriu uma enquete. Seu voto decide.';
    when 'arrived_home' then t := who || ' chegou bem'; b := 'Avisou que já está em casa.';
    when 'event_reminder' then t := 'Falta pouco'; b := 'Seu rolê começa em menos de 2 h. Bora se arrumar?'; img := '/push/falta-pouco.png';
    when 'night_recap' then t := 'Sua noite tá pronta'; b := 'O resumo do rolê de ontem saiu. Vem ver (e postar).'; img := '/push/sua-noite.png';
    when 'event_approved' then t := 'Tá no mapa'; b := 'O rolê que você sugeriu foi aprovado.';
    when 'achievement' then t := 'Conquista desbloqueada'; b := 'Você subiu de nível no rolê.';
    else t := 'FOMO'; b := 'Tem novidade pra você.';
  end case;
  if new.entity_type = 'event' and new.entity_id is not null then u := '/event/' || new.entity_id; end if;
  if new.entity_type = 'group' and new.entity_id is not null then u := '/group/' || new.entity_id; end if;
  insert into push_queue (user_id, title, body, url, tag, image) values (new.user_id, left(t, 120), left(b, 240), u, new.type, img);
  return new;
end $$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each row execute function private.enqueue_push_from_notification();

-- "Cutucadas": quinta/sexta/sábado à noite, para quem não está em nenhum rolê. 1 por dia, desligável.
-- Ordem: (1) amigos no rolê agora → "Alerta de FOMO" real; (2) grupo de hoje parado; (3) texto do catálogo,
-- sem repetir os 3 últimos que a pessoa recebeu.
create or replace function public.enqueue_nudges()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_dow int := extract(isodow from (now() at time zone 'America/Sao_Paulo'));
  n int; r record; f record; g record; c record; v_n int := 0;
begin
  select count(*) into n from events e
  where e.status = 'approved' and not coalesce(e.is_demo, false)
    and e.starts_at <= now() + interval '4 hours' and coalesce(e.ends_at, e.starts_at + interval '6 hours') > now();
  if n = 0 then return 0; end if;
  for r in
    select p.id, p.pronoun from profiles p
    where p.push_nudges and not coalesce(p.is_demo, false)
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
      and not exists (select 1 from check_ins ci where ci.user_id = p.id and ci.created_at > now() - interval '8 hours')
      and not exists (select 1 from push_queue q where q.user_id = p.id and q.tag = 'nudge' and q.created_at > now() - interval '20 hours')
  loop
    -- (1) amigos (quem a pessoa segue) com check-in visível nas últimas 3 h
    select min(pr.username) as fname, count(distinct ci.user_id)::int as k into f
    from follows fo join check_ins ci on ci.user_id = fo.followee_id join profiles pr on pr.id = ci.user_id
    where fo.follower_id = r.id and fo.status = 'accepted' and ci.visibility in ('public', 'followers')
      and ci.created_at > now() - interval '3 hours';
    if f.k > 0 then
      insert into push_queue (user_id, title, body, url, tag, image) values (r.id, 'Alerta de FOMO',
        '@' || f.fname || case when f.k > 1 then ' e mais ' || (f.k - 1) || case when f.k = 2 then ' amigo' else ' amigos' end else '' end
          || ' já ' || case when f.k > 1 then 'estão' else 'está' end || ' no rolê. E você?', '/', 'nudge', '/push/alerta.png');
      v_n := v_n + 1; continue;
    end if;
    -- (2) grupo de um rolê de hoje em que a pessoa topou/talvez
    select gr.id, gr.name into g from group_members gm join groups gr on gr.id = gm.group_id join events e on e.id = gr.event_id
    where gm.user_id = r.id and gm.status in ('going', 'maybe')
      and e.starts_at between now() - interval '2 hours' and now() + interval '8 hours'
    order by e.starts_at limit 1;
    if g.id is not null and random() < 0.6 then
      insert into push_queue (user_id, title, body, url, tag, image) values (r.id,
        'Seu grupo tá esperando alguém tomar a iniciativa…', left('Que tal você? Chama a galera do "' || g.name || '".', 240),
        '/group/' || g.id, 'nudge', '/push/bora.png');
      v_n := v_n + 1; continue;
    end if;
    -- (3) catálogo: do dia ou de qualquer dia, do público certo, sem repetir os últimos 3
    select pc.* into c from push_copy pc
    where pc.active and (pc.dow is null or pc.dow = v_dow)
      and (pc.audience = 'all' or pc.audience = r.pronoun or (pc.audience = 'unset' and r.pronoun is null))
      and pc.id not in (select q.copy_id from push_queue q where q.user_id = r.id and q.copy_id is not null order by q.id desc limit 3)
    order by random() limit 1;
    if c.id is null then continue; end if;
    insert into push_queue (user_id, title, body, url, tag, image, copy_id)
    values (r.id, c.title, left(replace(c.body, '{n}', n::text), 240), '/', 'nudge', c.image, c.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.enqueue_nudges() from public, anon, authenticated;

-- chama a Edge Function quando há push pendente (URL e segredo ficam no Vault, nunca no código)
create or replace function private.dispatch_push()
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from push_queue where sent_at is null and attempts < 5) then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(url := v_url, headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret), body := '{}'::jsonb, timeout_milliseconds := 20000);
end $$;

-- a Edge Function usa estas duas (service role) para ler e marcar a fila
create or replace function public.push_claim(p_limit int default 200)
returns table (queue_id bigint, sub_id uuid, endpoint text, p256dh text, auth text, title text, body text, url text, tag text, image text)
language sql security definer set search_path = public as $$
  with q as (
    update push_queue set attempts = attempts + 1
    where id in (select id from push_queue where sent_at is null and attempts < 5 and created_at > now() - interval '1 day' order by id limit p_limit for update skip locked)
    returning *
  )
  select q.id, s.id, s.endpoint, s.p256dh, s.auth, q.title, q.body, q.url, q.tag, q.image
  from q join push_subscriptions s on s.user_id = q.user_id;
$$;
create or replace function public.push_done(p_sent bigint[], p_gone uuid[], p_ok uuid[])
returns void language sql security definer set search_path = public as $$
  update push_queue set sent_at = now() where id = any(p_sent);
  delete from push_subscriptions where id = any(p_gone);
  update push_subscriptions set last_ok_at = now(), failures = 0 where id = any(p_ok);
$$;
revoke all on function public.push_claim(int) from public, anon, authenticated;
revoke all on function public.push_done(bigint[], uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.push_claim(int) to service_role;
grant execute on function public.push_done(bigint[], uuid[], uuid[]) to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j) from unnest(array['fomo_push_dispatch','fomo_nudge_thu','fomo_nudge_fri','fomo_nudge_sat','fomo_push_purge']) j
      where exists (select 1 from cron.job where jobname = j);
    perform cron.schedule('fomo_push_dispatch', '* * * * *', 'select private.dispatch_push();');
    perform cron.schedule('fomo_nudge_thu', '30 23 * * 4', 'select public.enqueue_nudges();');  -- qui 20h30 SP
    perform cron.schedule('fomo_nudge_fri', '0 23 * * 5', 'select public.enqueue_nudges();');   -- sex 20h SP
    perform cron.schedule('fomo_nudge_sat', '0 0 * * 0', 'select public.enqueue_nudges();');    -- sáb 21h SP
    perform cron.schedule('fomo_push_purge', '17 4 * * *', $q$delete from public.push_queue where created_at < now() - interval '7 days'$q$);
  end if;
end $$;

-- Configuração do despacho (chaves VAPID e segredo do cron) lida do Vault pela Edge Function (service role).
create or replace function public.push_config()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'vapid_public', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public'),
    'vapid_private', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_private'),
    'cron_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret'));
end $$;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;
