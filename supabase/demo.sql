-- ============================================================================
-- FOMO · conteúdo de DEMONSTRAÇÃO (não é migration; rodar 1x no SQL Editor).
-- Idempotente: pode rodar de novo sem duplicar. Remover: select public.demo_purge();
-- Perfis demo NÃO são pessoas reais e não têm senha (não fazem login).
-- ============================================================================

-- 1) contas técnicas (sem senha) para os perfis demo
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email,
       '{"provider":"demo","providers":[]}'::jsonb, '{"demo":true}'::jsonb, now(), now()
from (values
  ('de000000-0000-4000-8000-000000000001', 'lia@demo.fomo.invalid'),
  ('de000000-0000-4000-8000-000000000002', 'caio@demo.fomo.invalid'),
  ('de000000-0000-4000-8000-000000000003', 'bia@demo.fomo.invalid'),
  ('de000000-0000-4000-8000-000000000004', 'teo@demo.fomo.invalid'),
  ('de000000-0000-4000-8000-000000000005', 'nina@demo.fomo.invalid'),
  ('de000000-0000-4000-8000-000000000006', 'rafa@demo.fomo.invalid'),
  ('de000000-0000-4000-8000-000000000007', 'duda@demo.fomo.invalid'),
  ('de000000-0000-4000-8000-000000000008', 'gui@demo.fomo.invalid')
) as v(id, email)
on conflict (id) do nothing;

-- 2) perfis
insert into public.profiles (id, username, display_name, bio, city, is_private, level, xp, credibility_score,
  total_experiences, total_reviews, followers_count, following_count, is_demo, created_at)
values
  ('de000000-0000-4000-8000-000000000001', 'lia.demo',  'Lia (demo)',  'Pista, vinil e bar escondido. Perfil de demonstração.', 'São Paulo', false, 5, 1820, 86, 64, 41, 2310, 188, true, now() - interval '400 days'),
  ('de000000-0000-4000-8000-000000000002', 'caio.demo', 'Caio (demo)', 'Shows e festival. Perfil de demonstração.',             'São Paulo', false, 3,  460, 58, 22,  9, 980,  410, true, now() - interval '200 days'),
  ('de000000-0000-4000-8000-000000000003', 'bia.demo',  'Bia (demo)',  'Board games e karaokê. Perfil de demonstração.',         'São Paulo', false, 4,  980, 71, 35, 18, 640,  220, true, now() - interval '300 days'),
  ('de000000-0000-4000-8000-000000000004', 'teo.demo',  'Teo (demo)',  'Coquetelaria e bar de bairro. Perfil de demonstração.', 'São Paulo', false, 4, 1100, 79, 41, 27, 1200, 300, true, now() - interval '350 days'),
  ('de000000-0000-4000-8000-000000000005', 'nina.demo', 'Nina (demo)', 'Techno até o sol nascer. Perfil de demonstração.',       'São Paulo', false, 2,  190, 44,  8,  3, 150,  180, true, now() - interval '60 days'),
  ('de000000-0000-4000-8000-000000000006', 'rafa.demo', 'Rafa (demo)', 'Samba e roda de choro. Perfil de demonstração.',         'São Paulo', false, 3,  520, 63, 19, 11, 430,  260, true, now() - interval '150 days'),
  ('de000000-0000-4000-8000-000000000007', 'duda.demo', 'Duda (demo)', 'Indie, jazz e sarau. Perfil de demonstração.',           'São Paulo', false, 6, 3400, 91, 120, 77, 5200, 350, true, now() - interval '600 days'),
  ('de000000-0000-4000-8000-000000000008', 'gui.demo',  'Gui (demo)',  'Rooftop e pôr do sol. Perfil de demonstração.',          'São Paulo', false, 1,   40, 20,  2,  1, 30,   90, true, now() - interval '10 days')
on conflict (id) do nothing;

-- 3) rolês (locais e endereços FICTÍCIOS; bairros reais só para o mapa)
insert into public.events (id, title, description, category_id, status, starts_at, ends_at, venue_name, address,
  latitude, longitude, price_min_cents, price_max_cents, created_by, is_demo, demo_schedule, demo_crowd)
select v.id::uuid, v.title, v.descr, c.id, 'approved', now(), now() + interval '5 hours', v.venue, v.addr,
       v.lat, v.lng, v.pmin, v.pmax, 'de000000-0000-4000-8000-000000000001', true, v.sched, v.crowd
from (values
  ('de0e0000-0000-4000-8000-000000000001', 'Baile da Lua',        'Festa de house e disco com pista ao ar livre. [demo]', 'festas', 'Galpão Lunar',      'R. Fictícia, 120 — Barra Funda',  -23.5253, -46.6669, 4000, 8000, 'live', 4),
  ('de0e0000-0000-4000-8000-000000000002', 'Quinta do Vinil',     'Discotecagem só de vinil. Entrada livre até 22h. [demo]', 'bares', 'Bar do Disco',     'R. Fictícia, 45 — Pinheiros',     -23.5666, -46.6893,    0,    0, 'live', 2),
  ('de0e0000-0000-4000-8000-000000000003', 'Terraço Norte',       'Rooftop com DJ residente. [demo]',                      'bares',  'Terraço Norte',     'R. Fictícia, 210 — Vila Madalena', -23.5531, -46.6880,    0,    0, 'live', 3),
  ('de0e0000-0000-4000-8000-000000000004', 'Samba da Esquina',    'Roda de samba ao vivo. [demo]',                          'bares',  'Bar da Esquina',    'R. Fictícia, 12 — Pinheiros',     -23.5629, -46.6821, 2000, 2000, 'live', 3),
  ('de0e0000-0000-4000-8000-000000000005', 'Techno no Porão',     'Techno até de manhã. [demo]',                            'festas', 'Porão 404',         'R. Fictícia, 404 — Consolação',   -23.5517, -46.6559, 3000, 6000, 'live', 4),
  ('de0e0000-0000-4000-8000-000000000006', 'Karaokê da Liberdade','Cabines e palco aberto. [demo]',                         'geek',   'Karaokê Estrela',   'R. Fictícia, 88 — Liberdade',     -23.5603, -46.6339, 1500, 1500, 'live', 1),
  ('de0e0000-0000-4000-8000-000000000007', 'Jazz no Bixiga',      'Quarteto de jazz e drinks. [demo]',                      'shows',  'Clube Azul',        'R. Fictícia, 50 — Bela Vista',    -23.5605, -46.6489, 4000, 4000, 'd+1@21', null),
  ('de0e0000-0000-4000-8000-000000000008', 'Indie na Laje',       'Três bandas independentes. [demo]',                      'shows',  'Laje Sonora',       'Av. Fictícia, 900 — Centro',      -23.5432, -46.6388, 6000, 12000,'d+2@21', null),
  ('de0e0000-0000-4000-8000-000000000009', 'Noite de Board Games','200+ jogos e monitores. [demo]',                         'geek',   'Taverna do Dado',   'R. Fictícia, 300 — Liberdade',    -23.5587, -46.6345, 2500, 2500, 'd+3@19', null),
  ('de0e0000-0000-4000-8000-000000000010', 'Sunset no Terraço',   'Pôr do sol com DJ set. [demo]',                          'festas', 'Terraço Poente',    'R. Fictícia, 77 — Vila Madalena', -23.5558, -46.6912, 5000, 5000, 'd+4@17', null),
  ('de0e0000-0000-4000-8000-000000000011', 'Sarau na Praça',      'Microfone aberto para poesia e música. [demo]',          'cultura','Praça das Letras',  'Praça Fictícia — Bela Vista',     -23.5568, -46.6476,    0,    0, 'd+5@18', null)
) as v(id, title, descr, slug, venue, addr, lat, lng, pmin, pmax, sched, crowd)
join public.event_categories c on c.slug = v.slug
on conflict (id) do nothing;

-- 4) publicações (fotos: imagens abstratas geradas, empacotadas no app → caminho "demo/…")
insert into public.posts (id, author_id, body, event_id, place_name, experience_date, category_id, rating, visibility,
  media_count, likes_count, comments_count, is_demo, demo_age_min)
select v.id::uuid, v.author::uuid, v.body, v.event::uuid, v.place, (now() at time zone 'America/Sao_Paulo')::date, c.id, v.rating, 'public',
       v.media, v.likes, 0, true, v.age
from (values
  ('de0f0000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'Pista lotada mas sem aperto, som impecável e fila andou rápido. Volto com certeza.', 'de0e0000-0000-4000-8000-000000000001', 'Galpão Lunar', 'festas', 5, 3, 214, 50),
  ('de0f0000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000002', 'Bom line-up, mas o bar demorou demais. Vale ir cedo.', 'de0e0000-0000-4000-8000-000000000005', 'Porão 404', 'festas', 3, 1, 153, 180),
  ('de0f0000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000004', 'Dica: o balcão dos fundos tem drinks fora do cardápio. Pergunte pelo da casa.', null, 'Bar do Disco', 'bares', 4, 0, 87, 420),
  ('de0f0000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000003', 'Karaokê com fila organizada por app. Achei genial.', 'de0e0000-0000-4000-8000-000000000006', 'Karaokê Estrela', 'geek', 4, 1, 40, 75),
  ('de0f0000-0000-4000-8000-000000000005', 'de000000-0000-4000-8000-000000000001', 'Quinta do Vinil continua sendo o melhor esquenta grátis da cidade.', 'de0e0000-0000-4000-8000-000000000002', 'Bar do Disco', 'bares', 5, 2, 310, 1560),
  ('de0f0000-0000-4000-8000-000000000006', 'de000000-0000-4000-8000-000000000006', 'Roda de samba impecável hoje. Chegue antes das 21h.', 'de0e0000-0000-4000-8000-000000000004', 'Bar da Esquina', 'bares', 5, 1, 120, 25),
  ('de0f0000-0000-4000-8000-000000000007', 'de000000-0000-4000-8000-000000000005', 'Porão no talo. Som pesado do jeito certo.', 'de0e0000-0000-4000-8000-000000000005', 'Porão 404', 'festas', 4, 1, 66, 12),
  ('de0f0000-0000-4000-8000-000000000008', 'de000000-0000-4000-8000-000000000007', 'Rooftop com vista absurda. Drinks caros, mas vale o pôr do sol.', 'de0e0000-0000-4000-8000-000000000003', 'Terraço Norte', 'bares', 4, 2, 480, 300)
) as v(id, author, body, event, place, slug, rating, media, likes, age)
join public.event_categories c on c.slug = v.slug
on conflict (id) do nothing;

insert into public.post_media (post_id, storage_path, width, height, position)
values
  ('de0f0000-0000-4000-8000-000000000001', 'demo/night-1.jpg', 1080, 1350, 0),
  ('de0f0000-0000-4000-8000-000000000001', 'demo/night-3.jpg', 1080, 1080, 1),
  ('de0f0000-0000-4000-8000-000000000001', 'demo/night-5.jpg', 1080, 1350, 2),
  ('de0f0000-0000-4000-8000-000000000002', 'demo/night-2.jpg', 1080, 1350, 0),
  ('de0f0000-0000-4000-8000-000000000004', 'demo/night-6.jpg', 1080, 1080, 0),
  ('de0f0000-0000-4000-8000-000000000005', 'demo/night-4.jpg', 1080, 1350, 0),
  ('de0f0000-0000-4000-8000-000000000005', 'demo/night-1.jpg', 1080, 1350, 1),
  ('de0f0000-0000-4000-8000-000000000006', 'demo/night-5.jpg', 1080, 1350, 0),
  ('de0f0000-0000-4000-8000-000000000007', 'demo/night-2.jpg', 1080, 1350, 0),
  ('de0f0000-0000-4000-8000-000000000008', 'demo/night-3.jpg', 1080, 1080, 0),
  ('de0f0000-0000-4000-8000-000000000008', 'demo/night-6.jpg', 1080, 1080, 1)
on conflict (post_id, position) do nothing;

-- 5) avaliações demo
insert into public.reviews (author_id, event_id, rating, body, helpful_count)
values
  ('de000000-0000-4000-8000-000000000001', 'de0e0000-0000-4000-8000-000000000002', 5, 'Som bom, preço justo, equipe simpática.', 32),
  ('de000000-0000-4000-8000-000000000004', 'de0e0000-0000-4000-8000-000000000002', 4, 'Lota rápido depois das 22h.', 18),
  ('de000000-0000-4000-8000-000000000005', 'de0e0000-0000-4000-8000-000000000005', 5, 'Melhor sistema de som da região.', 9),
  ('de000000-0000-4000-8000-000000000006', 'de0e0000-0000-4000-8000-000000000004', 5, 'Roda de verdade, sem microfone estourado.', 14)
on conflict (author_id, event_id) do nothing;

-- 6) os gatilhos de post/avaliação recalculam XP pelo livro-razão; devolve os números de vitrine
update public.profiles p set xp = v.xp, level = v.lvl, credibility_score = v.cred, total_experiences = v.exps, total_reviews = v.revs
from (values
  ('de000000-0000-4000-8000-000000000001'::uuid, 1820, 5, 86, 64, 41), ('de000000-0000-4000-8000-000000000002'::uuid, 460, 3, 58, 22, 9),
  ('de000000-0000-4000-8000-000000000003'::uuid, 980, 4, 71, 35, 18),  ('de000000-0000-4000-8000-000000000004'::uuid, 1100, 4, 79, 41, 27),
  ('de000000-0000-4000-8000-000000000005'::uuid, 190, 2, 44, 8, 3),    ('de000000-0000-4000-8000-000000000006'::uuid, 520, 3, 63, 19, 11),
  ('de000000-0000-4000-8000-000000000007'::uuid, 3400, 6, 91, 120, 77),('de000000-0000-4000-8000-000000000008'::uuid, 40, 1, 20, 2, 1)
) as v(id, xp, lvl, cred, exps, revs)
where p.id = v.id;

-- 7) horários atuais + relatos ao vivo, e renovação a cada hora
select public.demo_refresh();
select cron.unschedule('fomo_demo_refresh') where exists (select 1 from cron.job where jobname = 'fomo_demo_refresh');
select cron.schedule('fomo_demo_refresh', '5 * * * *', $$ select public.demo_refresh(); $$);
