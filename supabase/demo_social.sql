-- ============================================================================
-- FOMO · conteúdo de DEMONSTRAÇÃO, parte social (rodar depois de demo.sql).
-- Idempotente. Tudo sai com: select public.demo_purge();
-- Perfis demo não são pessoas reais e não fazem login (sem senha); a bio diz
-- "Perfil de demonstração" e os rolês demo têm o selo DEMO no mapa.
-- "Pessoas reais" aqui = todos os perfis não-demo existentes na hora em que roda.
-- ============================================================================

-- nomes mais naturais (a marcação de demo continua na bio e no is_demo)
update public.profiles p set display_name = v.name
from (values
  ('de000000-0000-4000-8000-000000000001'::uuid, 'Lia Martins'), ('de000000-0000-4000-8000-000000000002'::uuid, 'Caio Reis'),
  ('de000000-0000-4000-8000-000000000003'::uuid, 'Bia Nogueira'), ('de000000-0000-4000-8000-000000000004'::uuid, 'Téo Andrade'),
  ('de000000-0000-4000-8000-000000000005'::uuid, 'Nina Campos'), ('de000000-0000-4000-8000-000000000006'::uuid, 'Rafa Souza'),
  ('de000000-0000-4000-8000-000000000007'::uuid, 'Duda Lima'), ('de000000-0000-4000-8000-000000000008'::uuid, 'Gui Prado')
) as v(id, name)
where p.id = v.id and p.is_demo;

-- 1) quem segue quem ----------------------------------------------------------
-- entre perfis demo
insert into public.follows (follower_id, followee_id, status)
select a::uuid, b::uuid, 'accepted' from (values
  ('de000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000002'), ('de000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000003'),
  ('de000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000007'), ('de000000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000001'),
  ('de000000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000005'), ('de000000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000001'),
  ('de000000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000004'), ('de000000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000003'),
  ('de000000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000006'), ('de000000-0000-4000-8000-000000000005', 'de000000-0000-4000-8000-000000000002'),
  ('de000000-0000-4000-8000-000000000006', 'de000000-0000-4000-8000-000000000007'), ('de000000-0000-4000-8000-000000000007', 'de000000-0000-4000-8000-000000000001'),
  ('de000000-0000-4000-8000-000000000007', 'de000000-0000-4000-8000-000000000006'), ('de000000-0000-4000-8000-000000000008', 'de000000-0000-4000-8000-000000000001')
) as v(a, b)
on conflict do nothing;

-- pessoas reais seguem 5 perfis demo (para ver stories, feed "Seguindo" e "quem tá indo")
insert into public.follows (follower_id, followee_id, status)
select r.id, d.id::uuid, 'accepted'
from public.profiles r
cross join (values ('de000000-0000-4000-8000-000000000001'), ('de000000-0000-4000-8000-000000000002'),
                   ('de000000-0000-4000-8000-000000000003'), ('de000000-0000-4000-8000-000000000004'),
                   ('de000000-0000-4000-8000-000000000007')) as d(id)
where not r.is_demo
on conflict do nothing;

-- 4 perfis demo seguem as pessoas reais (Lia e Téo viram "amigos"; Nina, Rafa e Gui viram sugestão "Segue você")
insert into public.follows (follower_id, followee_id, status)
select d.id::uuid, r.id, case when r.is_private then 'pending' else 'accepted' end
from public.profiles r
cross join (values ('de000000-0000-4000-8000-000000000001'), ('de000000-0000-4000-8000-000000000004'),
                   ('de000000-0000-4000-8000-000000000005'), ('de000000-0000-4000-8000-000000000006'),
                   ('de000000-0000-4000-8000-000000000008')) as d(id)
where not r.is_demo
on conflict do nothing;

-- 2) check-ins nos rolês ao vivo (mistura de público, amigos e anônimo: o número aparece, os nomes não) ---
insert into public.check_ins (user_id, event_id, status, visibility)
select u::uuid, e::uuid, 'declared', v from (values
  ('de000000-0000-4000-8000-000000000001', 'de0e0000-0000-4000-8000-000000000001', 'public'),
  ('de000000-0000-4000-8000-000000000002', 'de0e0000-0000-4000-8000-000000000001', 'friends'),
  ('de000000-0000-4000-8000-000000000003', 'de0e0000-0000-4000-8000-000000000001', 'public'),
  ('de000000-0000-4000-8000-000000000005', 'de0e0000-0000-4000-8000-000000000001', 'private'),
  ('de000000-0000-4000-8000-000000000008', 'de0e0000-0000-4000-8000-000000000001', 'private'),
  ('de000000-0000-4000-8000-000000000004', 'de0e0000-0000-4000-8000-000000000002', 'public'),
  ('de000000-0000-4000-8000-000000000006', 'de0e0000-0000-4000-8000-000000000002', 'friends'),
  ('de000000-0000-4000-8000-000000000007', 'de0e0000-0000-4000-8000-000000000002', 'public'),
  ('de000000-0000-4000-8000-000000000007', 'de0e0000-0000-4000-8000-000000000003', 'public'),
  ('de000000-0000-4000-8000-000000000001', 'de0e0000-0000-4000-8000-000000000003', 'private'),
  ('de000000-0000-4000-8000-000000000004', 'de0e0000-0000-4000-8000-000000000003', 'friends'),
  ('de000000-0000-4000-8000-000000000006', 'de0e0000-0000-4000-8000-000000000004', 'public'),
  ('de000000-0000-4000-8000-000000000002', 'de0e0000-0000-4000-8000-000000000004', 'private'),
  ('de000000-0000-4000-8000-000000000003', 'de0e0000-0000-4000-8000-000000000004', 'public'),
  ('de000000-0000-4000-8000-000000000005', 'de0e0000-0000-4000-8000-000000000005', 'public'),
  ('de000000-0000-4000-8000-000000000002', 'de0e0000-0000-4000-8000-000000000005', 'public'),
  ('de000000-0000-4000-8000-000000000008', 'de0e0000-0000-4000-8000-000000000005', 'friends')
) as v(u, e, v)
on conflict (user_id, event_id) where event_id is not null do nothing;

-- 3) stories (fotos demo empacotadas no app; "câmera dupla" em alguns) --------
insert into public.stories (id, author_id, storage_path, width, height, event_id, caption, visibility, is_dual)
values
  ('de05f000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'demo/night-1.jpg#s1', 1080, 1350, 'de0e0000-0000-4000-8000-000000000001', 'pista abrindo 🔥', 'public', true),
  ('de05f000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000001', 'demo/night-5.jpg#s2', 1080, 1350, 'de0e0000-0000-4000-8000-000000000001', 'chega que tá bom', 'public', false),
  ('de05f000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000002', 'demo/night-2.jpg#s3', 1080, 1350, 'de0e0000-0000-4000-8000-000000000005', 'porão no talo', 'public', true),
  ('de05f000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000003', 'demo/night-6.jpg#s4', 1080, 1080, 'de0e0000-0000-4000-8000-000000000006', 'fila do karaokê andando rápido', 'followers', false),
  ('de05f000-0000-4000-8000-000000000005', 'de000000-0000-4000-8000-000000000004', 'demo/night-4.jpg#s5', 1080, 1350, 'de0e0000-0000-4000-8000-000000000002', 'vinil + drink da casa', 'public', true),
  ('de05f000-0000-4000-8000-000000000006', 'de000000-0000-4000-8000-000000000004', 'demo/night-3.jpg#s6', 1080, 1080, null, 'esquenta', 'followers', false),
  ('de05f000-0000-4000-8000-000000000007', 'de000000-0000-4000-8000-000000000007', 'demo/night-3.jpg#s7', 1080, 1080, 'de0e0000-0000-4000-8000-000000000003', 'pôr do sol no terraço', 'public', false),
  ('de05f000-0000-4000-8000-000000000008', 'de000000-0000-4000-8000-000000000007', 'demo/night-1.jpg#s8', 1080, 1350, 'de0e0000-0000-4000-8000-000000000003', null, 'public', true)
on conflict (id) do nothing;

insert into public.story_views (story_id, viewer_id)
select s::uuid, v::uuid from (values
  ('de05f000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000002'), ('de05f000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000003'),
  ('de05f000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000001'), ('de05f000-0000-4000-8000-000000000005', 'de000000-0000-4000-8000-000000000003')
) as v(s, v)
on conflict do nothing;

-- 4) grupos com convite para as pessoas reais, enquete e localização ao vivo -----
insert into public.groups (id, event_id, owner_id, name)
values
  ('de06a000-0000-4000-8000-000000000001', 'de0e0000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'Sextou no Baile'),
  ('de06a000-0000-4000-8000-000000000002', 'de0e0000-0000-4000-8000-000000000007', 'de000000-0000-4000-8000-000000000004', 'Jazz de amanhã')
on conflict (id) do nothing;

insert into public.group_members (group_id, user_id, status, invited_by, responded_at)
select g::uuid, u::uuid, s, 'de000000-0000-4000-8000-000000000001'::uuid, case when s <> 'invited' then now() end from (values
  ('de06a000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'going'),
  ('de06a000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000002', 'going'),
  ('de06a000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000003', 'going'),
  ('de06a000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000004', 'maybe'),
  ('de06a000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000005', 'invited'),
  ('de06a000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000004', 'going'),
  ('de06a000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000006', 'going'),
  ('de06a000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000007', 'maybe')
) as v(g, u, s)
on conflict do nothing;

-- pessoas reais convidadas nos dois grupos (aparecem em "Quero ir" → convites)
insert into public.group_members (group_id, user_id, status, invited_by)
select g.id::uuid, r.id, 'invited', o.id::uuid
from public.profiles r
cross join (values ('de06a000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001'),
                   ('de06a000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000004')) as g(id, owner)
cross join lateral (select g.owner as id) o
where not r.is_demo
on conflict do nothing;

insert into public.group_polls (id, group_id, created_by, question, options)
values ('de07b000-0000-4000-8000-000000000001', 'de06a000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001',
        'Onde a gente esquenta?', array['Quinta do Vinil', 'Terraço Norte', 'Na casa da Lia'])
on conflict (id) do nothing;
insert into public.group_poll_votes (poll_id, user_id, option)
values ('de07b000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 0),
       ('de07b000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000002', 0),
       ('de07b000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000003', 1)
on conflict do nothing;

-- Caio e Bia compartilhando localização com o grupo (perto do Baile da Lua)
insert into public.group_locations (group_id, user_id, latitude, longitude, accuracy_m, expires_at)
values ('de06a000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000002', -23.5262, -46.6655, 20, now() + interval '90 minutes'),
       ('de06a000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000003', -23.5311, -46.6702, 35, now() + interval '90 minutes')
on conflict do nothing;

-- 5) direct: Lia (que você segue) e Nina (que você não segue → "Solicitações") puxam conversa ---
do $$
declare r record; cid uuid; who uuid; txt text;
begin
  for r in select id from public.profiles where not is_demo loop
    foreach who in array array['de000000-0000-4000-8000-000000000001'::uuid, 'de000000-0000-4000-8000-000000000005'::uuid] loop
      select a.conversation_id into cid from public.conversation_members a join public.conversation_members b on b.conversation_id = a.conversation_id
      where a.user_id = r.id and b.user_id = who limit 1;
      continue when cid is not null;
      insert into public.conversations default values returning id into cid;
      insert into public.conversation_members (conversation_id, user_id, last_read_at) values (cid, who, now()), (cid, r.id, null);
      txt := case when who = 'de000000-0000-4000-8000-000000000001'::uuid
                  then 'Bora no Baile da Lua hoje? Te chamei no grupo 👀' else 'oi! vi que você curte techno, vai no Porão hoje?' end;
      insert into public.messages (conversation_id, sender_id, body) values (cid, who, txt);
    end loop;
  end loop;
end $$;

-- horários de tudo "para agora" + renovação automática a cada 15 min
select public.demo_refresh();
select cron.unschedule('fomo_demo_refresh') where exists (select 1 from cron.job where jobname = 'fomo_demo_refresh');
select cron.schedule('fomo_demo_refresh', '*/15 * * * *', $$ select public.demo_refresh(); $$);
