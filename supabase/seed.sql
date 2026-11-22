-- Dados de configuração (não são dados de usuário). Seguro para produção.

insert into public.event_categories (slug, name, sort_order) values
  ('festas', 'Festas', 1), ('bares', 'Bares', 2), ('shows', 'Shows', 3),
  ('geek', 'Geek', 4), ('cultura', 'Cultura', 5)
on conflict (slug) do nothing;

insert into public.level_definitions (level, name, min_xp) values
  (1, 'Novato', 0), (2, 'Saideiro', 100), (3, 'Rato do Rolê', 300),
  (4, 'Explorador Noturno', 700), (5, 'Lenda da Madrugada', 1500),
  (6, 'Insider', 3000), (7, 'Lenda do FOMO', 6000)
on conflict (level) do update set name = excluded.name, min_xp = excluded.min_xp;

-- Valores iniciais, ajustáveis sem deploy. daily_cap/cooldown impedem farming.
insert into public.xp_rules (key, description, amount, daily_cap, cooldown_seconds, requires_review) values
  ('post_with_photo', 'Publicação com foto de um rolê', 15, 3, 600, false),
  ('post_text', 'Publicação em texto com conteúdo (40+ caracteres)', 5, 3, 600, false),
  ('review', 'Avaliação de evento', 10, 5, 300, false),
  ('review_helpful', 'Sua avaliação foi marcada como útil', 3, 20, 0, false),
  ('live_report', 'Relato ao vivo no local', 10, 6, 1800, true),
  ('verified_checkin', 'Presença confirmada', 20, 2, 0, false)
on conflict (key) do update set description = excluded.description, amount = excluded.amount,
  daily_cap = excluded.daily_cap, cooldown_seconds = excluded.cooldown_seconds, requires_review = excluded.requires_review;

insert into public.live_config (id) values (true) on conflict (id) do nothing;

insert into public.achievements (key, name, description, icon, criteria) values
  ('first_post', 'Primeiro rolê', 'Publicou o primeiro rolê com foto.', 'camera', '{"posts_with_photo": 1}'),
  ('first_report', 'Termômetro', 'Fez o primeiro relato ao vivo confirmado.', 'activity', '{"live_reports_granted": 1}'),
  ('explorer_5', 'Eclético', 'Rolês em 5 categorias diferentes.', 'compass', '{"distinct_categories": 5}'),
  ('helpful_10', 'Referência', '10 pessoas diferentes acharam suas avaliações úteis.', 'badge-check', '{"helpful_voters": 10}')
on conflict (key) do nothing;
