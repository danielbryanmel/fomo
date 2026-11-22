# FOMO — Modelo de dados inicial (Supabase / PostgreSQL)

> **Status: implementado** em `supabase/migrations/` e coberto por 76 testes (`supabase/tests/run.mjs`). Divergências do desenho original estão marcadas com **(impl.)**.

Convenções: `id uuid default gen_random_uuid()`, `created_at/updated_at timestamptz default now()`, snake_case no banco, camelCase no app (mapeado nos repositories). Toda tabela com **RLS ligado** e políticas explícitas para select/insert/update/delete.

## Princípio: o cliente nunca escreve sinais de reputação

Colunas `level`, `xp`, `credibility_score`, contadores (`followers_count` etc.) e `check_ins.status = 'verified'` **só são alterados por funções `security definer` e triggers no servidor**. O papel `authenticated` não tem `UPDATE` nessas colunas (column-level privileges + trigger de proteção).

## Helpers de autorização (SQL, `security definer`, `stable`)

- `is_blocked(a, b)` — existe bloqueio em qualquer direção.
- `can_view_profile_content(viewer, owner)` — `viewer = owner` **ou** (`not is_blocked` **e** (`owner.is_private = false` **ou** follow `accepted`)).
- `can_view_item(viewer, owner, visibility)` — `public` → `can_view_profile_content`; `followers` → follow `accepted` ou dono; `private` → só o dono.

Todas as políticas de leitura de conteúdo usam esses helpers — visibilidade é garantida no backend, não escondendo elementos na UI.

## Tabelas

### profiles — 1:1 com `auth.users`
Espelha o tipo `UserProfile`.
`id (pk, fk auth.users)`, `username citext unique` (regex `^[a-z0-9_.]{3,30}$`), `display_name`, `avatar_url`, `bio (≤280)`, `city null`, `is_private bool default false`,
`level int default 1`, `xp int default 0`, `credibility_score numeric(5,2) default 0`,
`total_experiences`, `total_reviews`, `followers_count`, `following_count` (contadores por trigger), `created_at`.
- **Popularidade** = followers/likes · **Experiência** = xp/level · **Credibilidade** = credibility_score → três colunas, três origens.
- RLS: select de campos básicos (nome, @, avatar, nível, contadores) para todos não bloqueados — perfil privado é *descobrível*, mas o conteúdo não; update só `id = auth.uid()` e só em colunas editáveis.

### follows
`follower_id`, `followee_id`, `status ('pending'|'accepted')`, `created_at`, `responded_at`; pk (follower_id, followee_id); check follower ≠ followee.
- Trigger de insert: se o alvo é público → `accepted`; se privado → `pending`. O cliente não escolhe o status.
- Update de `pending → accepted` só pelo `followee`. Delete pelo seguidor (deixar de seguir) ou pelo seguido (remover seguidor).
- Índices: (followee_id, status), (follower_id, status).

### blocks
`blocker_id`, `blocked_id`, `created_at`; pk composta. Bloquear remove follows nas duas direções (trigger). Visível só para o `blocker`.

### event_categories
`id`, `slug unique` (festas, bares, shows, geek, …), `name`, `sort_order`. Leitura pública; escrita só admin.

### events
Consulta do mapa: RPC `events_in_bounds(north, south, east, west, origin, filtros, limit)` com índice GiST — o app nunca baixa todos os eventos (mock equivalente em `listForMap`).

`id`, `title`, `description`, `category_id fk`, `status ('pending'|'approved'|'cancelled'|'ended')`, `starts_at`, `ends_at`, `venue_name`, `address`, `location geography(Point)` (PostGIS), `price_min_cents`, `price_max_cents`, `ticket_url`, `cover_path`, `organizer_id null` (futuro `organizer_profiles`), `created_by fk profiles`, `is_sponsored bool default false`, `sponsored_until`, timestamps.
- Leitura: `approved` para todos; `pending` só para o criador e moderadores.
- "Futuros" = `status='approved' and coalesce(ends_at, starts_at + interval '8 hours') > now()`; job (pg_cron) marca `ended`.
- Índices: GiST em `location`, (status, starts_at), category_id. Consulta do mapa via RPC `events_in_bounds(bbox, filtros, cursor)`.

### posts — rolê vivido (≠ evento futuro)
`id`, `author_id`, `body (≤2000)`, `event_id null`, `place_name null`, `experience_date date null` (≤ hoje), `category_id null`, `rating smallint null check 1..5`, `check_in_id null fk check_ins`, `visibility ('public'|'followers'|'private')`, `likes_count`, `comments_count`, `moderation_status ('visible'|'hidden'|'removed')`, timestamps.
- **Presença**: `check_in_id null` → publicação sem declaração; senão herda `check_ins.status` (`declared`/`verified`). A UI nunca mostra `declared` como comprovado.
- RLS select: `can_view_item(auth.uid(), author_id, visibility) and moderation_status='visible'` (autor vê os próprios ocultos).

### post_media
`id`, `post_id fk cascade`, `storage_path`, `width`, `height`, `position`, `blurhash`. Herda visibilidade do post via política com `exists`.

### reviews
`id`, `author_id`, `event_id null`, `place_key null` (futuro `places`), `rating 1..5`, `body`, `post_id null`, `helpful_count`, `moderation_status`, timestamps. Unique (author_id, event_id). Votos de "útil" em `review_votes(review_id, voter_id)` — alimentam credibilidade, com limites por par de usuários para evitar voto coordenado.

### likes / comments
`likes(post_id, user_id, created_at)` pk composta. `comments(id, post_id, author_id, body ≤500, parent_id null, moderation_status, timestamps)`. Só é possível curtir/comentar o que `can_view_item` permite.

### saved_events / saved_posts
pk (user_id, event_id|post_id), `created_at`. Select/insert/delete só `user_id = auth.uid()`.

### check_ins — espelha o tipo `CheckIn`
`id`, `user_id`, `event_id null`, `status ('declared'|'verified') default 'declared'`, `verification_method null ('organizer_code'|'qr_code'|'one_time_location'|'admin_review')`, `visibility ('public'|'followers'|'private') default 'followers'`, `created_at`, `verified_at null`.
- Insert pelo cliente **sempre** como `declared`. Promoção a `verified` só pela RPC `verify_check_in(...)`, que valida o código/QR/leitura única de localização no servidor.
- Sem coordenadas brutas persistidas; a leitura única de localização é comparada no servidor e descartada.
- Um check-in por (user_id, event_id); rate limit por dia.

### live_reports — termômetro ao vivo (Fase 3, adotado do conceito em vídeo)
`id`, `user_id`, `event_id`, `crowd smallint check 1..4`, `vibe ('chato'|'ok'|'bom'|'bombando')`, `music null ('ruim'|'ok'|'bom'|'sem_som')`, `queue ('sem_fila'|'curta'|'media'|'longa')`, `verification ('one_time_location')`, `created_at`.
- Insert **só via RPC `submit_live_report(event_id, crowd, vibe, music, queue, lat, lng)`** (`security definer`): valida evento acontecendo agora, distância ≤ `live_config.max_distance_m` (200 m) com PostGIS, cooldown por pessoa/evento (30 min) e rate limit. **lat/lng não são gravados** — só usados na comparação.
- Leitura: ninguém lê linhas individuais (sem política de select para `authenticated`). O app lê o agregado pela view/RPC `live_status(event_id)`: mediana da lotação, moda de vibe/música/fila, contagem e último horário, só com relatos dos últimos 90 min e só se houver ≥ 3.
- XP do relato entra como `user_xp_transactions` com `status='pending'` e é confirmado por job que descarta padrões suspeitos (muitos relatos divergentes da maioria, contas novas em massa no mesmo local).
- Índices: (event_id, created_at desc), (user_id, event_id, created_at desc).

### live_config (configuração)
`report_ttl_min = 90`, `min_reports_to_show = 3`, `max_distance_m = 200`, `cooldown_min = 30`. Editável por admin; o app tem cópia só de exibição em `src/config/live.ts`.

### user_xp_transactions — livro-razão de XP
`id`, `user_id`, `rule_key` (fk `xp_rules`), `amount`, `source_type`, `source_id`, `status ('granted'|'reverted')`, `created_at`, `reviewed_by null`.
- Unique (user_id, rule_key, source_id) → impede XP duplicado pela mesma ação.
- Escrita só por funções do servidor. `profiles.xp` = soma de `granted` (trigger); nível derivado de `level_definitions`.

### xp_rules / level_definitions (configuração)
`xp_rules(key, amount, daily_cap, cooldown_seconds, active)` — ex.: post com foto + local, review marcada útil, check-in verificado.
`level_definitions(level, name, min_xp)` — 1 Novato … 7 Lenda do FOMO. Editável por admin sem deploy.

### achievements / user_achievements
`achievements(id, key unique, name, description, icon, criteria jsonb, active)`; `user_achievements(user_id, achievement_id, granted_at)` pk composta. Concedidas só pelo servidor.

### credibility_snapshots (complemento)
`user_id`, `score`, `factors jsonb` (helpful_reviews, consistency, moderation_history, diversity, verified_presence), `formula_version`, `computed_at`. Permite mostrar a explicação ao usuário e auditar mudanças de fórmula. Seguidores e curtidas **não** entram.

### reports
`id`, `reporter_id`, `target_type ('post'|'comment'|'profile'|'event'|'review')`, `target_id`, `reason`, `details`, `status ('open'|'actioned'|'dismissed')`, `handled_by`, timestamps. Insert por qualquer autenticado (rate limit); leitura só do próprio denunciante e de moderadores.

### notifications
`id`, `user_id`, `type`, `actor_id`, `entity_type`, `entity_id`, `read_at`, `created_at`. Geradas por trigger; leitura/update (marcar lida) só pelo dono. Realtime nesta tabela.

## Storage
- `avatars/{user_id}/…` — leitura pública, escrita só na própria pasta.
- `post-media/{user_id}/{post_id}/…` — bucket **privado**; leitura via URL assinada emitida após `can_view_item`.
- `event-covers/{event_id}/…` — leitura pública após aprovação.

## Feed "Para você" (V2 — explicável)
`score = w_recência·decay(idade) + w_qualidade·(credibilidade do autor normalizada) + w_interesse·match(categorias) + w_proximidade·(distância, só se localização autorizada) + w_engajamento·log(1+likes)`.
Pesos em tabela de configuração, engajamento com peso baixo e limitado. Implementado em RPC paginada por cursor. "Seguindo" = cronológico reverso.

## Implementação — notas (Fase 5)
- **Sem PostGIS no MVP**: `events(latitude, longitude)` + índice parcial `(latitude, longitude) where status='approved'`; distância por `haversine_m()`. Troca para `geography` é localizada (2 funções).
- **Privilégios por coluna**: além da RLS, o cliente só pode `UPDATE` colunas editáveis (ex.: `profiles(display_name, avatar_url, bio, city, is_private, default_checkin_visibility)`). XP, nível, credibilidade, contadores e status de moderação são inalteráveis pelo app.
- **Funções internas** (`award_xp`, `recompute_credibility`, `confirm_pending_live_xp`, `end_past_events`) têm `EXECUTE` revogado de `anon`/`authenticated` — encontrado pelos testes: no Supabase, funções novas são executáveis por esses papéis por padrão.
- **post_media**: só é criado via `create_post()`, que valida que cada arquivo está em `{autor}/{post}/` — ninguém anexa foto de outra pessoa.
- **Feed "Seguindo"** inclui os próprios posts (como apps de fotos).
- `posts.media_count` + check: post precisa ter texto **ou** foto.
