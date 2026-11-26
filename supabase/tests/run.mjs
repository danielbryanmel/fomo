#!/usr/bin/env node
/**
 * Testes de segurança e regras do banco do FOMO (RLS, RPCs, triggers, storage).
 * Roda as migrations reais num Postgres em memória (PGlite) com um shim do Supabase.
 *   cd supabase/tests && npm i @electric-sql/pglite && node run.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const db = new PGlite();

let pass = 0;
let fail = 0;
const results = [];
function ok(name, cond, extra = '') {
  if (cond) pass++;
  else fail++;
  results.push(`${cond ? '✔' : '✘'} ${name}${extra && !cond ? ` — ${extra}` : ''}`);
}

const A = '00000000-0000-0000-0000-00000000000a'; // público
const B = '00000000-0000-0000-0000-00000000000b'; // privado
const C = '00000000-0000-0000-0000-00000000000c'; // público
const D = '00000000-0000-0000-0000-00000000000d'; // estranho

async function as(user, sql, params) {
  await db.exec('reset role');
  if (user === 'anon') {
    await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false);");
  } else if (user) {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  }
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}
async function fails(user, sql, params) {
  try {
    await as(user, sql, params);
    return null;
  } catch (e) {
    return e.message;
  }
}
const one = async (user, sql, params) => (await as(user, sql, params)).rows[0];

// ── setup
await db.exec(readFileSync(join(here, 'supabase_shim.sql'), 'utf8'));
for (const f of readdirSync(join(root, 'migrations')).sort()) {
  try {
    await db.exec(readFileSync(join(root, 'migrations', f), 'utf8'));
  } catch (e) {
    console.error(`Falha na migration ${f}: ${e.message}`);
    process.exit(1);
  }
}
await db.exec(readFileSync(join(root, 'seed.sql'), 'utf8'));
await db.exec(`insert into auth.users (id, email) values ('${A}','a@x'),('${B}','b@x'),('${C}','c@x'),('${D}','d@x')`);
ok('migrations + seed aplicadas', true);

// ── perfis
await as(A, "select claim_profile('ana_a', 'Ana')");
await as(B, "select claim_profile('bia.b', 'Bia')");
await as(C, "select claim_profile('caio_c', 'Caio')");
await as(D, "select claim_profile('davi_d', 'Davi')");
ok('claim_profile cria perfis', (await one(null, 'select count(*)::int n from profiles')).n === 4);
ok('username inválido rejeitado', !!(await fails(A, "select claim_profile('A!', 'x')")));
ok('username duplicado rejeitado', /username_taken/.test((await fails(D, "select claim_profile('ana_a', 'x')")) ?? ''));
ok('username reservado rejeitado', !!(await fails(D, "select claim_profile('admin', 'x')")));
await as(B, 'update profiles set is_private = true where id = auth.uid()');
ok('usuário edita a própria bio', !(await fails(A, "update profiles set bio = 'oi' where id = auth.uid()")));
ok('usuário NÃO altera o próprio XP', !!(await fails(A, 'update profiles set xp = 99999 where id = auth.uid()')));
ok('usuário NÃO altera a própria credibilidade', !!(await fails(A, 'update profiles set credibility_score = 100 where id = auth.uid()')));
ok('usuário NÃO altera contadores', !!(await fails(A, 'update profiles set followers_count = 1000000 where id = auth.uid()')));
await as(A, "update profiles set bio = 'hack' where id = $1", [C]);
ok('usuário NÃO edita perfil alheio', (await one(null, 'select bio from profiles where id = $1', [C])).bio === null);

// ── follows
await as(A, 'insert into follows (follower_id, followee_id, status) values (auth.uid(), $1, $2)', [B, 'accepted']);
ok('seguir perfil privado → pending (mesmo pedindo accepted)', (await one(null, 'select status from follows where follower_id=$1 and followee_id=$2', [A, B])).status === 'pending');
await as(A, 'insert into follows (follower_id, followee_id) values (auth.uid(), $1)', [C]);
ok('seguir perfil público → accepted', (await one(null, 'select status from follows where follower_id=$1 and followee_id=$2', [A, C])).status === 'accepted');
ok('contador de seguidores atualizado', (await one(null, 'select followers_count from profiles where id=$1', [C])).followers_count === 1);
ok('seguidor NÃO aprova a própria solicitação', (await as(A, "update follows set status='accepted' where follower_id=auth.uid() and followee_id=$1", [B])).affectedRows === 0);
ok('não dá para seguir em nome de outro', !!(await fails(D, 'insert into follows (follower_id, followee_id) values ($1, $2)', [A, C])));

// ── posts e visibilidade
const P1 = '10000000-0000-0000-0000-000000000001';
const P2 = '10000000-0000-0000-0000-000000000002';
const P3 = '10000000-0000-0000-0000-000000000003';
ok('INSERT direto em posts é bloqueado', !!(await fails(A, "insert into posts (author_id, body) values (auth.uid(), 'x')")));
await as(B, `select create_post($1, 'rolê privado', $2::jsonb)`, [P1, JSON.stringify([{ path: `${B}/${P1}/a.jpg`, width: 1080, height: 1350 }])]);
ok('create_post com foto funciona', (await one(null, 'select media_count from posts where id=$1', [P1])).media_count === 1);
ok('perfil privado: post invisível p/ quem não segue (A pendente)', (await as(A, 'select id from posts where id=$1', [P1])).rows.length === 0);
ok('perfil privado: mídia invisível p/ quem não segue', (await as(A, 'select id from post_media where post_id=$1', [P1])).rows.length === 0);
ok('perfil privado: post invisível p/ anônimo', (await as('anon', 'select id from posts where id=$1', [P1])).rows.length === 0);
await as(B, "update follows set status='accepted' where follower_id=$1 and followee_id=auth.uid()", [A]);
ok('dono aprova solicitação', (await one(null, 'select status from follows where follower_id=$1 and followee_id=$2', [A, B])).status === 'accepted');
ok('após aprovação, seguidor vê o post', (await as(A, 'select id from posts where id=$1', [P1])).rows.length === 1);
ok('estranho continua sem ver', (await as(D, 'select id from posts where id=$1', [P1])).rows.length === 0);

ok('mídia de outra pasta é rejeitada', /invalid_media_path/.test((await fails(A, `select create_post($1, 'x', $2::jsonb)`, [P2, JSON.stringify([{ path: `${C}/${P2}/a.jpg` }])])) ?? ''));
ok('mais de 10 fotos é rejeitado', /too_many_media/.test((await fails(A, `select create_post($1, 'x', $2::jsonb)`, [P2, JSON.stringify(Array.from({ length: 11 }, (_, i) => ({ path: `${A}/${P2}/f${i}.jpg` })))])) ?? ''));
ok('post vazio (sem texto e sem foto) é rejeitado', !!(await fails(A, `select create_post($1, '', '[]'::jsonb)`, [P2])));
await as(C, `select create_post($1, 'só pra seguidores, com foto', $2::jsonb, null, 'Bar X', null, null, 4::smallint, 'followers', true)`, [P3, JSON.stringify([{ path: `${C}/${P3}/a.jpg` }])]);
ok('post "seguidores": seguidor vê', (await as(A, 'select id from posts where id=$1', [P3])).rows.length === 1);
ok('post "seguidores": estranho não vê', (await as(D, 'select id from posts where id=$1', [P3])).rows.length === 0);
const ci = await one(null, 'select c.status, c.verification_method from posts p join check_ins c on c.id = p.check_in_id where p.id=$1', [P3]);
ok('presença via post é só DECLARADA', ci?.status === 'declared' && ci?.verification_method === null);
ok('cliente NÃO cria check-in verificado', !!(await fails(A, "insert into check_ins (user_id, status, verification_method) values (auth.uid(), 'verified', 'qr_code')")));
ok('cliente NÃO altera status do check-in', !!(await fails(C, "update check_ins set status='verified' where user_id=auth.uid()")));
ok('autor NÃO altera likes_count', !!(await fails(C, 'update posts set likes_count = 9999 where id=$1', [P3])));
ok('autor edita a legenda', !(await fails(C, "update posts set body = 'editado' where id=$1", [P3])));
await as(D, "update posts set body = 'hack' where id=$1", [P3]);
ok('outro usuário NÃO edita o post', (await one(null, 'select body from posts where id=$1', [P3])).body === 'editado');

// ── XP
ok('XP concedido por post com foto', (await one(null, 'select xp from profiles where id=$1', [C])).xp === 15);
const P4 = '10000000-0000-0000-0000-000000000004';
await as(C, `select create_post($1, 'outro', $2::jsonb)`, [P4, JSON.stringify([{ path: `${C}/${P4}/a.jpg` }])]);
ok('cooldown impede farming de XP (2º post em seguida = 0 XP)', (await one(null, 'select xp from profiles where id=$1', [C])).xp === 15);
await as(C, 'delete from posts where id=$1', [P3]);
ok('excluir post reverte o XP ganho com ele', (await one(null, 'select xp from profiles where id=$1', [C])).xp === 0);
ok('usuário NÃO lê XP de outro', (await as(A, 'select * from user_xp_transactions where user_id=$1', [C])).rows.length === 0);

// ── curtidas
await as(A, 'insert into likes (post_id, user_id) values ($1, auth.uid())', [P1]);
ok('curtir incrementa contador', (await one(null, 'select likes_count from posts where id=$1', [P1])).likes_count === 1);
ok('estranho NÃO curte post que não pode ver', !!(await fails(D, 'insert into likes (post_id, user_id) values ($1, auth.uid())', [P1])));
ok('notificação de curtida criada p/ autor', (await one(null, "select count(*)::int n from notifications where user_id=$1 and type='like'", [B])).n === 1);
ok('usuário NÃO lê notificações alheias', (await as(A, 'select * from notifications where user_id=$1', [B])).rows.length === 0);

// ── eventos e moderação
const cat = (await one(null, "select id from event_categories where slug='festas'")).id;
ok('usuário cria evento pendente', !(await fails(A, `insert into events (title, category_id, starts_at, latitude, longitude, created_by) values ('Festa teste', $1, now() + interval '1 day', -23.55, -46.63, auth.uid())`, [cat])));
ok('usuário NÃO cria evento já aprovado', !!(await fails(A, `insert into events (title, category_id, status, starts_at, latitude, longitude, created_by) values ('X', $1, 'approved', now(), -23.55, -46.63, auth.uid())`, [cat])));
ok('usuário NÃO cria evento patrocinado', !!(await fails(A, `insert into events (title, category_id, starts_at, latitude, longitude, created_by, is_sponsored) values ('X', $1, now(), -23.55, -46.63, auth.uid(), true)`, [cat])));
ok('criador NÃO aprova o próprio evento', !!(await fails(A, "update events set status='approved' where created_by=auth.uid()")));
ok('evento pendente invisível para outros', (await as(D, "select id from events where title='Festa teste'")).rows.length === 0);

// evento acontecendo agora (criado pelo "admin")
const E = (await one(null, `insert into events (title, category_id, status, starts_at, ends_at, latitude, longitude, created_by, venue_name)
  values ('Baile', $1, 'approved', now() - interval '1 hour', now() + interval '4 hours', -23.5253, -46.6669, $2, 'Galpão 33') returning id`, [cat, A])).id;
await db.exec(`insert into events (title, category_id, status, starts_at, latitude, longitude, created_by) values ('Futuro', '${cat}', 'approved', now() + interval '2 days', -23.56, -46.69, '${A}')`);
const map = await as(D, `select event from events_in_bounds(-23.50, -23.60, -46.60, -46.72, -23.55, -46.68, null, 'any')`);
ok('mapa retorna só eventos aprovados na área', map.rows.length === 2 && map.rows.every((r) => r.event.status === 'approved'));
const outside = await as(D, `select event from events_in_bounds(-22.0, -22.1, -43.0, -43.1)`);
ok('mapa não retorna eventos fora da área', outside.rows.length === 0);
const nowOnly = await as(D, `select event from events_in_bounds(-23.50, -23.60, -46.60, -46.72, null, null, null, 'now')`);
ok('filtro "agora" retorna só o que está rolando', nowOnly.rows.length === 1 && nowOnly.rows[0].event.happeningNow === true);

// ── relato ao vivo
const far = await fails(D, 'select submit_live_report($1, 4::smallint, $2, null, $3, -23.60, -46.70)', [E, 'bombando', 'curta']);
ok('relato longe do local é recusado', /too_far/.test(far ?? ''), far ?? '');
ok('anônimo NÃO envia relato', !!(await fails('anon', 'select submit_live_report($1, 4::smallint, $2, null, $3, -23.5253, -46.6669)', [E, 'bombando', 'curta'])));
const rep = await one(D, 'select submit_live_report($1, 4::smallint, $2, null, $3, -23.5254, -46.6670) r', [E, 'bombando', 'curta']);
ok('relato no local é aceito com XP pendente', rep.r.accepted === true && rep.r.xpPending === 10);
ok('XP de relato fica pendente; só a presença confirmada (+20) soma na hora', (await one(null, 'select xp from profiles where id=$1', [D])).xp === 20);
ok('cooldown de relato', /cooldown/.test((await fails(D, 'select submit_live_report($1, 4::smallint, $2, null, $3, -23.5254, -46.6670)', [E, 'bombando', 'curta'])) ?? ''));
ok('ninguém lê relatos individuais', (await as(A, 'select * from live_reports')).rows.length === 0);
ok('cliente NÃO insere relato direto', !!(await fails(A, "insert into live_reports (user_id, event_id, crowd, vibe, queue) values (auth.uid(), $1, 4, 'bom', 'curta')", [E])));
let st = (await one(A, 'select live_status($1) s', [E])).s;
ok('lotação oculta com menos de 3 relatos', st.crowd === null && st.reportsCount === 1);
await as(A, 'select submit_live_report($1, 4::smallint, $2, $3, $4, -23.5253, -46.6669)', [E, 'bom', 'bom', 'curta']);
await as(B, 'select submit_live_report($1, 3::smallint, $2, null, $3, -23.5253, -46.6669)', [E, 'bombando', 'sem_fila']);
st = (await one(D, 'select live_status($1) s', [E])).s;
ok('lotação aparece com 3 relatos (mediana)', st.crowd === 4 && st.reportsCount === 3, JSON.stringify(st));
ok('coordenadas NÃO são gravadas', !(await one(null, "select count(*)::int n from information_schema.columns where table_name='live_reports' and column_name in ('lat','lng','latitude','longitude')")).n);

// ── bloqueio
await as(B, 'insert into blocks (blocker_id, blocked_id) values (auth.uid(), $1)', [A]);
ok('bloqueio remove follow', (await one(null, 'select count(*)::int n from follows where follower_id=$1 and followee_id=$2', [A, B])).n === 0);
ok('bloqueado não vê o perfil de quem bloqueou', (await as(A, 'select id from profiles where id=$1', [B])).rows.length === 0);
ok('bloqueado não consegue seguir de novo', !!(await fails(A, 'insert into follows (follower_id, followee_id) values (auth.uid(), $1)', [B])));

// ── storage
await db.exec(`insert into storage.buckets (id, name) values ('x','x') on conflict do nothing`);
ok('upload na própria pasta permitido', !(await fails(A, `insert into storage.objects (bucket_id, name) values ('post-media', $1)`, [`${A}/p/a.jpg`])));
ok('upload na pasta de outro bloqueado', !!(await fails(A, `insert into storage.objects (bucket_id, name) values ('post-media', $1)`, [`${C}/p/a.jpg`])));
await db.exec(`insert into storage.objects (bucket_id, name, owner) values ('post-media', '${B}/${P1}/a.jpg', '${B}')`);
ok('foto de post privado: estranho não lê', (await as(D, "select name from storage.objects where bucket_id='post-media' and name=$1", [`${B}/${P1}/a.jpg`])).rows.length === 0);
ok('foto de post privado: dono lê', (await as(B, "select name from storage.objects where bucket_id='post-media' and name=$1", [`${B}/${P1}/a.jpg`])).rows.length === 1);

// ── feed e credibilidade
const P5 = '10000000-0000-0000-0000-000000000005';
await as(C, `select create_post($1, 'post público com bastante texto para contar como conteúdo', '[]'::jsonb)`, [P5]);
const fy = await as(A, "select id from feed('for_you')");
ok('feed "Para você" traz post público de outros', fy.rows.some((r) => r.id === P5));
const fw = await as(A, "select author_id from feed('following')");
const followed = (await as(A, "select followee_id from follows where follower_id = auth.uid() and status = 'accepted'")).rows.map((r) => r.followee_id);
ok('feed "Seguindo" só traz quem eu sigo', fw.rows.length > 0 && fw.rows.every((r) => followed.includes(r.author_id) || r.author_id === A));
const fyD = await as(D, "select visibility, author_id from feed('for_you')");
ok('feed "Para você" nunca traz post não-público', fyD.rows.every((r) => r.visibility === 'public'));
ok('cliente NÃO chama recompute_credibility', !!(await fails(A, 'select recompute_credibility(auth.uid())')));
const cred = (await one(null, 'select recompute_credibility($1) s', [C])).s;
ok('credibilidade calculada no servidor (0–100)', Number(cred) >= 0 && Number(cred) <= 100);
ok('cliente NÃO confirma XP pendente', !!(await fails(A, 'select confirm_pending_live_xp()')));
ok('cliente NÃO concede XP a si mesmo', !!(await fails(A, "select award_xp(auth.uid(), 'review', 'x', gen_random_uuid())")));
ok('cliente NÃO encerra eventos', !!(await fails(A, 'select end_past_events()')));
ok('helpers de autorização fora da API (schema private)', (await one(null, "select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('can_view_item','is_blocked','follow_status','can_view_profile_content','is_moderator')")).n === 0);
ok('anônimo NÃO executa RPCs do app', !!(await fails('anon', "select * from feed('for_you')")));
ok('funções de trigger não executáveis pelo cliente', !!(await fails(A, 'select xp_tx_sync()')));
const rel = (await one(A, 'select profile_relationship($1) r', [C])).r;
ok('profile_relationship devolve relação do usuário logado', rel.followStatus === 'accepted' && rel.canViewContent === true && rel.isSelf === false);
// job de confirmação (roda como servidor): relatos coerentes viram XP
await db.exec("update user_xp_transactions set created_at = now() - interval '1 hour' where rule_key = 'live_report'");
await db.query('select confirm_pending_live_xp()');
ok('job confirma XP de relato coerente (+10)', (await one(null, 'select xp from profiles where id=$1', [D])).xp === 30);

// ── Fase 6
ok('relato aceito confirma presença (verificada)', (await one(null, "select status, verification_method from check_ins where user_id=$1 and event_id=$2", [D, E])).status === 'verified');
ok('cliente NÃO modera evento', /forbidden/.test((await fails(A, "select moderate_event((select id from events where title='Festa teste'), true)")) ?? ''));
await db.exec(`update profiles set is_moderator = true where id = '${C}'`);
await as(C, "select moderate_event((select id from events where title='Festa teste'), true)");
ok('moderador aprova evento pendente', (await one(null, "select status from events where title='Festa teste'")).status === 'approved');
ok('criador é notificado da aprovação', (await one(null, "select count(*)::int n from notifications where user_id=$1 and type='event_approved'", [A])).n === 1);
ok('conquista "primeiro rolê" concedida por post com foto', (await one(null, "select count(*)::int n from user_achievements ua join achievements a on a.id=ua.achievement_id where ua.user_id=$1 and a.key='first_post'", [B])).n === 1);
const pols = (await one(null, "select count(*)::int n from pg_policies where schemaname='public' and (qual ~ 'auth\\.uid\\(\\)' and qual !~ 'SELECT auth\\.uid')")).n;
ok('políticas usam (select auth.uid())', pols === 0, String(pols));

// ── Fase 6 · social (0007)
const rep2 = await one(C, 'select submit_live_report($1, 2::smallint, $2, null, $3, -23.5253, -46.6669) r', [E, 'ok', 'sem_fila']);
ok('relato devolve XP da presença (do servidor)', rep2.r.presenceVerified === true && rep2.r.presenceXp === 20, JSON.stringify(rep2.r));
ok('avatar de outro domínio recusado', /invalid_avatar/.test((await fails(A, "update profiles set avatar_url = 'https://evil.example/x.jpg' where id = auth.uid()")) ?? ''));
ok('avatar da pasta de outro usuário recusado', !!(await fails(A, `update profiles set avatar_url = 'https://p.supabase.co/storage/v1/object/public/avatars/${C}/a.jpg' where id = auth.uid()`)));
ok('avatar da própria pasta aceito', !(await fails(A, `update profiles set avatar_url = 'https://p.supabase.co/storage/v1/object/public/avatars/${A}/a.jpg' where id = auth.uid()`)));
await as(B, 'delete from blocks where blocker_id = auth.uid()');
await as(D, 'insert into follows (follower_id, followee_id) values (auth.uid(), $1)', [B]);
ok('solicitação para privado gera notificação', (await one(null, "select count(*)::int n from notifications where user_id=$1 and type='follow_request' and actor_id=$2", [B, D])).n === 1);
ok('estranho NÃO aceita solicitação alheia', (await as(C, "update follows set status='accepted' where follower_id=$1 and followee_id=$2 returning 1", [D, B])).rows.length === 0);
await as(B, "update follows set status='accepted' where follower_id=$1 and followee_id=auth.uid()", [D]);
ok('aceitar limpa a notificação de solicitação', (await one(null, "select count(*)::int n from notifications where user_id=$1 and type='follow_request' and actor_id=$2", [B, D])).n === 0);
ok('aceitar notifica quem pediu', (await one(null, "select count(*)::int n from notifications where user_id=$1 and type='follow_accepted'", [D])).n === 1);
const sub = (t) => as(D, `insert into events (title, category_id, starts_at, latitude, longitude, created_by) values ($1, '${cat}', now() + interval '1 day', -23.55, -46.65, auth.uid())`, [t]);
ok('usuário sugere rolê (fica pendente)', !(await fails(D, `insert into events (title, category_id, starts_at, latitude, longitude, created_by) values ('Sugestão 1', '${cat}', now() + interval '1 day', -23.55, -46.65, auth.uid())`)) && (await one(null, "select status from events where title='Sugestão 1'")).status === 'pending');
ok('usuário NÃO sugere rolê já aprovado', !!(await fails(D, `insert into events (title, category_id, status, starts_at, latitude, longitude, created_by) values ('Fura fila', '${cat}', 'approved', now() + interval '1 day', -23.55, -46.65, auth.uid())`)));
ok('sugestão no passado recusada', /event_in_past/.test((await fails(D, `insert into events (title, category_id, starts_at, latitude, longitude, created_by) values ('Antigo', '${cat}', now() - interval '3 days', -23.55, -46.65, auth.uid())`)) ?? ''));
for (let i = 2; i <= 5; i++) await sub(`Sugestão ${i}`);
ok('limite diário de sugestões', /rate_limited/.test((await fails(D, `insert into events (title, category_id, starts_at, latitude, longitude, created_by) values ('Sugestão 6', '${cat}', now() + interval '1 day', -23.55, -46.65, auth.uid())`)) ?? ''));
ok('não-moderador não vê sugestões alheias', (await as(A, "select id from events where status='pending' and created_by=$1", [D])).rows.length === 0);
ok('moderador vê a fila', (await as(C, "select id from events where status='pending' and created_by=$1", [D])).rows.length === 5);
await as(C, "select moderate_event((select id from events where title='Sugestão 1'), false)");
ok('moderador recusa sugestão', (await one(null, "select status from events where title='Sugestão 1'")).status === 'cancelled');
ok('notificações: cada um só vê as suas', (await as(A, 'select distinct user_id from notifications')).rows.every((r) => r.user_id === A));
ok('usuário marca notificações como lidas', !(await fails(A, 'update notifications set read_at = now() where read_at is null')));
ok('usuário NÃO altera tipo da notificação', !!(await fails(A, "update notifications set type = 'like'")));

// ── Social 2 (0010)
const P6 = '10000000-0000-0000-0000-000000000006';
ok('nota com meia estrela aceita', !(await fails(C, `select create_post($1, 'texto com nota fracionada para teste', '[]'::jsonb, null, null, null, null, 3.5)`, [P6])) && Number((await one(null, 'select rating from posts where id=$1', [P6])).rating) === 3.5);
ok('nota 3.3 recusada', /invalid_rating/.test((await fails(C, `select create_post(gen_random_uuid(), 'x', '[]'::jsonb, null, null, null, null, 3.3)`)) ?? ''));
ok('troca de @ grátis funciona', (await one(D, "select (change_username('davi_novo')).username u")).u === 'davi_novo');
ok('segunda troca de @ exige pagamento', /username_change_paid/.test((await fails(D, "select change_username('davi_outro')")) ?? ''));
ok('@ de outra pessoa recusado', /username_taken/.test((await fails(A, "select change_username('caio_c')")) ?? ''));
ok('cliente NÃO zera o contador de trocas', !!(await fails(D, 'update profiles set username_changes = 0 where id = auth.uid()')));
const conv = (await one(A, 'select start_conversation($1) c', [C])).c;
ok('abre conversa 1:1', !!conv);
ok('reabrir conversa reaproveita a mesma', (await one(C, 'select start_conversation($1) c', [A])).c === conv);
ok('participante manda mensagem', !(await fails(A, "insert into messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'bora?')", [conv])));
ok('estranho NÃO lê a conversa', (await as(D, 'select * from messages where conversation_id=$1', [conv])).rows.length === 0);
ok('estranho NÃO escreve na conversa', !!(await fails(D, "insert into messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'oi')", [conv])));
ok('não dá para mandar em nome de outro', !!(await fails(C, "insert into messages (conversation_id, sender_id, body) values ($1, $2, 'fake')", [conv, A])));
ok('destinatário recebe notificação de mensagem', (await one(null, "select count(*)::int n from notifications where user_id=$1 and type='message'", [C])).n === 1);
const inbox = (await one(C, 'select inbox() i')).i;
ok('caixa de entrada mostra não lida', inbox.length === 1 && inbox[0].unread === true && inbox[0].other.id === A);
const g = (await one(A, "select create_group($1, 'Sextou', array[$2, $3]::uuid[]) g", [E, C, D])).g;
ok('cria grupo com convidados', (await one(null, 'select count(*)::int n from group_members where group_id=$1', [g])).n === 3);
ok('convidado é notificado', (await one(null, "select count(*)::int n from notifications where user_id=$1 and type='group_invite'", [C])).n === 1);
await as(C, "select respond_group($1, 'going')", [g]);
await as(D, "select respond_group($1, 'maybe')", [g]);
const gj = (await one(C, 'select group_json($1) j', [g])).j;
ok('grupo mostra confirmados e talvez', gj.counts.going === 2 && gj.counts.maybe === 1 && gj.myStatus === 'going');
ok('quem não é do grupo NÃO vê o grupo', (await one(B, 'select group_json($1) j', [g])).j === null);
ok('cliente NÃO se insere em grupo', !!(await fails(B, "insert into group_members (group_id, user_id, status) values ($1, auth.uid(), 'going')", [g])));
ok('resposta inválida recusada', !!(await fails(C, "select respond_group($1, 'sim')", [g])));
const sid = '20000000-0000-0000-0000-000000000001';
for (let k = 0; k < 3; k++) await as(A, `insert into events (title, category_id, starts_at, latitude, longitude, created_by, series_id) values ('Série semanal', '${cat}', now() + interval '1 day' + make_interval(days => ${k * 7}), -23.55, -46.65, auth.uid(), '${sid}')`);
await as(C, "select moderate_event((select id from events where series_id = $1 order by starts_at limit 1), true)", [sid]);
ok('aprovar 1 rolê aprova a série inteira', (await one(null, "select count(*)::int n from events where series_id=$1 and status='approved'", [sid])).n === 3);

// ── Social 3
const inbox2 = (await one(A, 'select inbox() i')).i;
ok('direct: inbox marca quem eu sigo e se já respondi', inbox2[0].iFollow === true && inbox2[0].replied === true);
const inboxC = (await one(C, 'select inbox() i')).i;
ok('direct: para quem só recebeu, conta como solicitação', inboxC[0].replied === false);
await as(C, "insert into check_ins (user_id, event_id, visibility) values (auth.uid(), $1, 'followers') on conflict do nothing", [E]);
const fr = (await one(A, 'select event_friends($1) f', [E])).f;
ok('quem tá indo: amigo com presença visível aparece', fr.some((p) => p.id === C), JSON.stringify(fr.map((p) => p.username)));
ok('quem tá indo: quem NÃO segue não vê ninguém', (await one(D, 'select event_friends($1) f', [E])).f.every((p) => p.id !== C));
ok('quem tá indo: "vou" em grupo alheio NÃO vaza', (await one(B, 'select event_friends($1) f', [E])).f.every((p) => p.id !== C));
const E2 = (await one(A, `insert into events (title, category_id, starts_at, latitude, longitude, created_by) values ('Em 1h', '${cat}', now() + interval '1 hour', -23.55, -46.65, auth.uid()) returning id`)).id;
await as(C, 'select moderate_event($1, true)', [E2]);
const g2 = (await one(A, "select create_group($1, 'Daqui a pouco', array[$2]::uuid[]) g", [E2, C])).g;
await as(C, "select respond_group($1, 'going')", [g2]);
ok('cliente NÃO dispara lembretes', !!(await fails(A, 'select send_event_reminders()')));
await db.query('select send_event_reminders()');
await db.query('select send_event_reminders()');
ok('lembrete 2 h antes: 1 por pessoa confirmada (sem repetir)', (await one(null, "select count(*)::int n from notifications where type='event_reminder' and entity_id=$1", [g2])).n === 2);
const poll = (await one(A, "select create_poll($1, 'Onde esquenta?', array['Bar A','Casa do Caio','']) p", [g])).p;
ok('enquete criada e grupo notificado', !!poll && (await one(null, "select count(*)::int n from notifications where type='group_poll' and entity_id=$1", [g])).n >= 1);
await as(C, 'select vote_poll($1, 1::smallint)', [poll]);
await as(C, 'select vote_poll($1, 0::smallint)', [poll]);
await as(D, 'select vote_poll($1, 0::smallint)', [poll]);
const gp = (await one(C, 'select group_json($1) j', [g])).j.polls[0];
ok('enquete: voto único por pessoa (troca de voto)', gp.votes[0] === 2 && gp.votes[1] === 0 && gp.myVote === 0 && gp.options.length === 2);
ok('enquete: quem não é do grupo NÃO vota', !!(await fails(B, 'select vote_poll($1, 0::smallint)', [poll])));
ok('enquete: opção inexistente recusada', !!(await fails(C, 'select vote_poll($1, 3::smallint)', [poll])));
ok('enquete: quem não é do grupo NÃO lê', (await as(B, 'select * from group_polls where id=$1', [poll])).rows.length === 0);
ok('enquete: cliente NÃO insere voto direto', !!(await fails(B, 'insert into group_poll_votes (poll_id, user_id, option) values ($1, auth.uid(), 0)', [poll])));

// ── Social 4: check-in seguro, stories, sugestões, cheguei bem
await as(C, 'insert into follows (follower_id, followee_id) values (auth.uid(), $1) on conflict do nothing', [A]);
await db.query('delete from check_ins where event_id=$1', [E]);
const pr1 = (await one(C, "select check_in($1, 'friends', 0) p", [E])).p;
ok('check-in: presença sozinha NÃO mostra número (menos de 3)', pr1.count === null && pr1.few === true && pr1.me.visibility === 'friends');
ok('check-in "amigos": amigo (segue e é seguido) vê', (await as(A, 'select id from check_ins where user_id=$1 and event_id=$2', [C, E])).rows.length === 1);
ok('check-in "amigos": estranho NÃO vê', (await as(D, 'select id from check_ins where user_id=$1 and event_id=$2', [C, E])).rows.length === 0);
ok('check-in "amigos": quem só é seguido NÃO vê', (await as(B, 'select id from check_ins where user_id=$1 and event_id=$2', [C, E])).rows.length === 0);
await as(C, "select check_in($1, 'public', 120)", [E]);
ok('check-in "mostrar depois": ninguém vê antes da hora', (await as(A, 'select id from check_ins where user_id=$1 and event_id=$2', [C, E])).rows.length === 0
  && (await as(D, 'select id from check_ins where user_id=$1 and event_id=$2', [C, E])).rows.length === 0);
ok('check-in "mostrar depois": a própria pessoa vê', (await as(C, 'select id from check_ins where user_id=auth.uid() and event_id=$1', [E])).rows.length === 1);
await db.query("update group_members set status='maybe' where group_id=$1 and user_id=$2", [g, C]);
ok('check-in "mostrar depois": não aparece em "quem tá indo"', (await one(A, 'select event_friends($1) f', [E])).f.every((p) => p.id !== C));
await db.query("update group_members set status='going' where group_id=$1 and user_id=$2", [g, C]);
await as(A, "select check_in($1, 'private', 0)", [E]);
await as(D, "select check_in($1, 'public', 0)", [E]);
const pr3 = (await one(D, 'select event_presence($1) p', [E])).p;
ok('check-in anônimo ainda conta no rolê (3 pessoas = número aparece)', pr3.count === 3);
ok('check-in anônimo: ninguém vê quem é', (await as(C, 'select id from check_ins where user_id=$1 and event_id=$2', [A, E])).rows.length === 0);
ok('cliente NÃO se marca como verificado', !!(await fails(D, "update check_ins set status='verified', verification_method='qr_code', verified_at=now() where user_id=auth.uid()")));
const farEv = (await one(C, `insert into events (title, category_id, starts_at, latitude, longitude, created_by) values ('Mês que vem', '${cat}', now() + interval '30 days', -23.55, -46.65, auth.uid()) returning id`)).id;
await as(C, 'select moderate_event($1, true)', [farEv]);
ok('check-in fora do horário recusado', /checkin_closed/.test((await fails(A, "select check_in($1, 'public', 0)", [farEv])) ?? ''));
ok('visibilidade inválida recusada', !!(await fails(A, "select check_in($1, 'todo_mundo', 0)", [E])));

const S1 = '30000000-0000-0000-0000-000000000001';
ok('story: caminho de outra pessoa recusado', /invalid_media_path/.test((await fails(C, `select create_story($1, $2, 1080, 1920)`, [S1, `${A}/stories/${S1}.jpg`])) ?? ''));
await as(C, `select create_story($1, $2, 1080, 1920, $3, 'tá bom aqui', 'followers', true)`, [S1, `${C}/stories/${S1}.jpg`, E]);
const trayA = (await one(A, 'select stories_tray() t')).t;
ok('story: seguidor vê na bandeja, como não visto', trayA.some((g) => g.author.id === C && g.hasUnseen && g.stories[0].isDual));
ok('story: estranho NÃO vê', (await one(D, 'select stories_tray() t')).t.every((g) => g.author.id !== C)
  && (await as(D, 'select id from stories where id=$1', [S1])).rows.length === 0);
ok('story: estranho NÃO marca visualização', !!(await fails(D, 'select view_story($1)', [S1])));
await as(A, 'select view_story($1)', [S1]);
await as(A, 'select view_story($1)', [S1]);
ok('story: autor vê quem viu (sem duplicar)', (await one(C, 'select story_viewers($1) v', [S1])).v.length === 1);
ok('story: só o autor vê a lista de quem viu', (await one(A, 'select story_viewers($1) v', [S1])).v.length === 0);
ok('story: visto some do "não visto"', !(await one(A, 'select stories_tray() t')).t.find((g) => g.author.id === C).hasUnseen);
ok('story: cliente NÃO insere direto', !!(await fails(C, "insert into stories (id, author_id, storage_path) values (gen_random_uuid(), auth.uid(), 'x')")));
ok('story: cliente NÃO estica a validade', !!(await fails(C, "update stories set expires_at = now() + interval '30 days' where id=$1", [S1])));
await db.query("update stories set expires_at = now() - interval '1 minute' where id=$1", [S1]);
ok('story: vencido some para os outros', (await as(A, 'select id from stories where id=$1', [S1])).rows.length === 0);

const sugD = (await one(D, 'select suggested_people(20) s')).s;
const aFollows = new Set((await db.query('select followee_id from follows where follower_id=$1', [A])).rows.map((r) => r.followee_id));
ok('sugestões: nunca sugere quem eu já sigo nem eu mesmo', aFollows.size > 0 && (await one(A, 'select suggested_people(20) s')).s.every((x) => !aFollows.has(x.profile.id) && x.profile.id !== A));
ok('sugestões: check-in anônimo NÃO vira "foi nos mesmos rolês"', sugD.find((x) => x.profile.id === A)?.reason !== 'Foi nos mesmos rolês');
ok('sugestões: não expõe campos internos de pontuação', sugD.every((x) => !('mutuals' in x.profile) && !('same_events' in x.profile)));

ok('cheguei bem: avisa o grupo', (await one(C, 'select arrived_home($1) n', [g])).n === 2);
ok('cheguei bem: não repete o aviso', (await one(C, 'select arrived_home($1) n', [g])).n === 0);
ok('cheguei bem: quem não é do grupo NÃO dispara', !!(await fails(B, 'select arrived_home($1)', [g])));

// ── Social 5: localização com o grupo, modo discreto
ok('localização: precisa dizer por quanto tempo na 1ª vez', /not_sharing/.test((await fails(C, 'select share_group_location($1, -23.55, -46.65, 20)', [g])) ?? ''));
ok('localização: duração fora do limite recusada', !!(await fails(C, 'select share_group_location($1, -23.55, -46.65, 20, 600)', [g])));
await as(C, 'select share_group_location($1, -23.55, -46.65, 20, 60)', [g]);
const locA = (await one(A, 'select group_locations_json($1) l', [g])).l;
ok('localização: membro confirmado vê', locA.length === 1 && locA[0].profile.id === C);
ok('localização: quem não é do grupo NÃO vê', (await one(B, 'select group_locations_json($1) l', [g])).l.length === 0
  && (await as(B, 'select * from group_locations where group_id=$1', [g])).rows.length === 0);
ok('localização: quem não é do grupo NÃO compartilha', !!(await fails(B, 'select share_group_location($1, -23.5, -46.6, 10, 30)', [g])));
const exp1 = (await one(null, 'select expires_at from group_locations where group_id=$1 and user_id=$2', [g, C])).expires_at;
await as(C, 'select share_group_location($1, -23.56, -46.66, 15)', [g]);
const row2 = await one(null, 'select expires_at, latitude from group_locations where group_id=$1 and user_id=$2', [g, C]);
ok('localização: atualizar posição NÃO estica o prazo', +new Date(row2.expires_at) === +new Date(exp1) && Number(row2.latitude) === -23.56);
ok('localização: cliente NÃO insere direto', !!(await fails(A, 'insert into group_locations (group_id, user_id, latitude, longitude, expires_at) values ($1, auth.uid(), 0, 0, now() + interval \'9 days\')', [g])));
await db.query("update group_locations set expires_at = now() - interval '1 minute' where group_id=$1 and user_id=$2", [g, C]);
ok('localização: vencida some', (await one(A, 'select group_locations_json($1) l', [g])).l.length === 0);
await as(C, 'select share_group_location($1, -23.55, -46.65, 20, 30)', [g]);
await as(C, "select respond_group($1, 'declined')", [g]);
ok('localização: recusar o grupo para de compartilhar', (await one(null, 'select count(*)::int n from group_locations where group_id=$1 and user_id=$2', [g, C])).n === 0);
await as(C, "select respond_group($1, 'going')", [g]);

await as(D, 'select share_group_location($1, -23.5, -46.6, 10, 30)', [g]);
await as(D, 'select set_discreet_mode(true)');
ok('modo discreto: check-ins recentes viram anônimos', (await one(null, 'select visibility from check_ins where user_id=$1 and event_id=$2', [D, E])).visibility === 'private');
ok('modo discreto: para de compartilhar localização', (await one(null, 'select count(*)::int n from group_locations where user_id=$1', [D])).n === 0);
await as(D, "select check_in($1, 'public', 0)", [E]);
ok('modo discreto: check-in público vira anônimo no servidor', (await one(null, 'select visibility from check_ins where user_id=$1 and event_id=$2', [D, E])).visibility === 'private');
await as(D, "update check_ins set visibility = 'public' where user_id = auth.uid()");
ok('modo discreto: não dá para tornar público por fora', (await one(null, 'select visibility from check_ins where user_id=$1 and event_id=$2', [D, E])).visibility === 'private');
const S2 = '30000000-0000-0000-0000-000000000002';
await as(D, `select create_story($1, $2, 1080, 1440, $3, null, 'public', true)`, [S2, `${D}/stories/${S2}.jpg`, E]);
ok('modo discreto: story não marca o rolê', (await one(null, 'select event_id from stories where id=$1', [S2])).event_id === null);
ok('cliente NÃO liga o modo discreto de outra pessoa', (await as(D, 'update profiles set discreet_mode = false where id = auth.uid()').then(() => 'ok').catch(() => 'err')) === 'err'
  || (await one(null, 'select discreet_mode from profiles where id=$1', [D])).discreet_mode === true);
await as(D, 'select set_discreet_mode(false)');

// ── Registro de erros / reportar problema
await as(A, "select report_client_error('error', 'TypeError: x is undefined', '/feed', 'stack', 'UA', '0.1.0')");
await as(null, "select report_client_error('error', 'falha sem login', '/login')");
await as(A, "select report_client_error('feedback', 'O botão de postar não respondeu', '/compose')");
ok('erros: app registra (com e sem login, e relato)', (await one(null, 'select count(*)::int n from client_errors')).n === 3);
ok('erros: cliente NÃO lê os registros', !!(await fails(A, 'select * from client_errors')));
ok('erros: cliente NÃO insere direto', !!(await fails(A, "insert into client_errors (kind, message) values ('error', 'x')")));
for (let i = 0; i < 45; i++) await as(B, "select report_client_error('error', 'spam')");
ok('erros: limite por pessoa (40/10 min)', (await one(null, 'select count(*)::int n from client_errors where user_id=$1', [B])).n === 40);
ok('erros: tipo inválido ignorado', (await as(A, "select report_client_error('hack', 'x')").then(() => true)) && (await one(null, "select count(*)::int n from client_errors where kind not in ('error','feedback')")).n === 0);

// ── Social 6: curtir/responder story, grupos no direct
const S3 = '30000000-0000-0000-0000-000000000003';
await as(C, `select create_story($1, $2, 1080, 1920, null, 'teste', 'followers', false)`, [S3, `${C}/stories/${S3}.jpg`]);
ok('story: seguidor curte', (await one(A, 'select toggle_story_like($1) v', [S3])).v === true);
ok('story: autor recebe notificação de curtida', (await one(null, "select count(*)::int n from notifications where type='story_like' and entity_id=$1", [S3])).n === 1);
ok('story: autor vê quem curtiu', (await one(C, 'select story_viewers($1) v', [S3])).v.some((x) => x.profile.id === A && x.liked));
ok('story: bandeja mostra "curtido" e o total para o autor', (await one(A, 'select stories_tray() t', [])).t.find((g) => g.author.id === C).stories.find((x) => x.id === S3).liked === true
  && (await one(C, 'select stories_tray() t')).t.find((g) => g.author.id === C).stories.find((x) => x.id === S3).likes === 1);
ok('story: curtir de novo descurte', (await one(A, 'select toggle_story_like($1) v', [S3])).v === false);
ok('story: estranho NÃO curte', !!(await fails(D, 'select toggle_story_like($1)', [S3])));
ok('story: autor não curte o próprio', !!(await fails(C, 'select toggle_story_like($1)', [S3])));
const rc = (await one(A, "select reply_story($1, 'que lugar é esse?') c", [S3])).c;
const rm = await one(null, 'select body, reply_label, story_id from messages where conversation_id=$1 order by created_at desc limit 1', [rc]);
ok('story: resposta vira mensagem no direct com rótulo', rm.body === 'que lugar é esse?' && rm.reply_label === 'Respondeu ao story · teste' && rm.story_id === S3);
ok('story: estranho NÃO responde', !!(await fails(D, "select reply_story($1, 'oi')", [S3])));

await as(D, 'insert into follows (follower_id, followee_id) values (auth.uid(), $1) on conflict do nothing', [A]);
const gc = (await one(A, "select create_group_chat('Rolê de sexta', array[$1, $2, $3]::uuid[]) c", [B, C, D])).c;
ok('grupo no direct: entra só quem tem ligação (B ficou de fora)', (await one(null, 'select count(*)::int n from conversation_members where conversation_id=$1', [gc])).n === 3
  && (await one(null, 'select count(*)::int n from conversation_members where conversation_id=$1 and user_id=$2', [gc, B])).n === 0);
await as(A, "insert into messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'bora?')", [gc]);
const inbC = (await one(C, 'select inbox() i')).i.find((c) => c.id === gc);
ok('grupo no direct: aparece na caixa com nome e rostos', inbC && inbC.isGroup && inbC.title === 'Rolê de sexta' && inbC.memberCount === 3 && inbC.members.length === 2 && inbC.unread);
ok('grupo no direct: membro manda mensagem', !(await fails(D, "insert into messages (conversation_id, sender_id, body) values ($1, auth.uid(), 'bora!')", [gc])));
ok('grupo no direct: quem é de fora NÃO lê', (await as(B, 'select * from messages where conversation_id=$1', [gc])).rows.length === 0);
const before = (await one(null, 'select count(*)::int n from conversation_members where conversation_id=$1', [gc])).n;
await as(A, 'select add_to_group_chat($1, array[$2]::uuid[])', [gc, '00000000-0000-0000-0000-0000000000ff']);
ok('grupo no direct: não adiciona quem não existe/sem ligação', (await one(null, 'select count(*)::int n from conversation_members where conversation_id=$1', [gc])).n === before);
ok('grupo no direct: de fora NÃO adiciona gente', !!(await fails(B, 'select add_to_group_chat($1, array[$2]::uuid[])', [gc, B])));
const info = (await one(D, 'select conversation_info($1) i', [gc])).i;
ok('grupo no direct: cabeçalho com membros', info.isGroup && info.members.length === 3);
ok('grupo no direct: 1:1 continua separado do grupo', (await one(A, 'select start_conversation($1) c', [C])).c !== gc);
await as(D, 'select leave_conversation($1)', [gc]);
ok('grupo no direct: sair do grupo', (await one(null, 'select count(*)::int n from conversation_members where conversation_id=$1', [gc])).n === 2);
ok('grupo no direct: título vazio recusado', !!(await fails(A, "select create_group_chat('  ', array[$1]::uuid[])", [C])));

// ── conteúdo demo (supabase/demo.sql)
await db.exec(`alter table auth.users add column if not exists instance_id uuid, add column if not exists aud text, add column if not exists role text,
  add column if not exists raw_app_meta_data jsonb, add column if not exists raw_user_meta_data jsonb, add column if not exists updated_at timestamptz;
  create schema if not exists cron; create table if not exists cron.job (jobname text);
  create or replace function cron.schedule(n text, s text, c text) returns int language sql as $$ insert into cron.job values (n) returning 1 $$;
  create or replace function cron.unschedule(n text) returns boolean language sql as $$ delete from cron.job where jobname = n returning true $$;`);
await db.exec(readFileSync(join(root, 'demo.sql'), 'utf8'));
await db.exec(readFileSync(join(root, 'demo.sql'), 'utf8')); // idempotente
ok('demo: 8 perfis, 11 rolês, 8 posts (idempotente)', (await one(null, "select (select count(*) from profiles where is_demo)::int p, (select count(*) from events where is_demo)::int e, (select count(*) from posts where is_demo)::int t")).p === 8
  && (await one(null, 'select count(*)::int n from events where is_demo')).n === 11 && (await one(null, 'select count(*)::int n from posts where is_demo')).n === 8);
ok('demo: XP de vitrine preservado', (await one(null, "select xp, level from profiles where username='duda.demo'")).level === 6);
const liveDemo = await as(D, "select event from events_in_bounds(-23.50, -23.60, -46.60, -46.72, null, null, null, 'now')");
ok('demo: rolês ao vivo aparecem no mapa "agora"', liveDemo.rows.filter((r) => r.event.title === 'Baile da Lua').length === 1);
const stDemo = (await one(D, "select live_status('de0e0000-0000-4000-8000-000000000001') s")).s;
ok('demo: termômetro com relatos suficientes', stDemo.crowd === 4 && stDemo.reportsCount >= 3, JSON.stringify(stDemo));
ok('demo: aparece no "Para você"', (await as(D, "select id from feed('for_you', null, 50)")).rows.some((r) => r.id === 'de0f0000-0000-4000-8000-000000000001'));
ok('cliente NÃO cria rolê marcado como demo', !!(await fails(A, `insert into events (title, category_id, starts_at, latitude, longitude, created_by, is_demo) values ('Fake demo', '${cat}', now() + interval '1 day', -23.55, -46.65, auth.uid(), true)`)));
ok('cliente NÃO roda demo_refresh/demo_purge', !!(await fails(A, 'select demo_refresh()')) && !!(await fails(A, 'select demo_purge()')));
ok('cliente NÃO se marca como demo', !!(await fails(A, 'update profiles set is_demo = true where id = auth.uid()')));
await db.exec(readFileSync(join(root, 'demo_social.sql'), 'utf8'));
await db.exec(readFileSync(join(root, 'demo_social.sql'), 'utf8')); // idempotente
// lugares reais + shows reais (seeds de produção) — idempotentes e só leitura no app
await db.exec(readFileSync(join(root, 'venues_sp.sql'), 'utf8'));
await db.exec(readFileSync(join(root, 'venues_sp.sql'), 'utf8'));
await db.exec(readFileSync(join(root, 'events_sp.sql'), 'utf8'));
await db.exec(readFileSync(join(root, 'events_sp.sql'), 'utf8'));
ok('lugares: seed carregado e visível sem login', (await one(null, 'select count(*)::int n from venues')).n >= 40);
ok('lugares: cliente NÃO cria nem edita lugar', !!(await fails(A, "insert into venues (name, kind, address, latitude, longitude) values ('x bar', 'bar', 'rua x', 0, 0)")) && !!(await fails(A, "update venues set name = 'hack'")));
ok('shows reais: aprovados e ligados ao lugar', (await one(null, "select count(*)::int n from events e join venues v on v.id = e.venue_id where e.status = 'approved'")).n === 4);
const BAILE = 'de0e0000-0000-4000-8000-000000000001';
// "O que pesou?" (aspects) na avaliação: lista fechada validada no banco
ok('avaliação: aspectos inválidos são recusados', !!(await fails(B, "insert into reviews (author_id, event_id, rating, aspects) values (auth.uid(), $1, 4, array['hackeado'])", [BAILE])));
await as(B, "insert into reviews (author_id, event_id, rating, aspects) values (auth.uid(), $1, 4, array['som','lotacao'])", [BAILE]);
await as(B, "update reviews set aspects = array['fila'] where author_id = auth.uid() and event_id = $1", [BAILE]);
ok('avaliação: salva e edita "o que pesou"', (await one(B, 'select aspects from reviews where author_id = auth.uid() and event_id = $1', [BAILE])).aspects.join() === 'fila');
// "Sua noite tá pronta": quem postou ontem à noite recebe 1 aviso por dia; cliente não dispara
await db.query("insert into posts (author_id, body, created_at) values ($1, 'noite boa', ((now() at time zone 'America/Sao_Paulo')::date - 1 + time '23:30') at time zone 'America/Sao_Paulo')", [A]);
await db.query('select send_night_recaps()');
await db.query('select send_night_recaps()');
ok('minha noite: aviso enviado uma vez só', (await db.query("select count(*)::int n from notifications where user_id = $1 and type = 'night_recap'", [A])).rows[0].n === 1);
ok('minha noite: cliente NÃO dispara avisos', !!(await fails(A, 'select send_night_recaps()')));
const trayB = (await one(B, 'select stories_tray() t')).t;
ok('demo social: pessoa real vê stories dos demo que segue', trayB.filter((g) => g.author.is_demo).length >= 4 && trayB.every((g) => g.stories.every((s) => new Date(s.expiresAt) > new Date())));
ok('demo social: presença do Baile aparece (≥3)', (await one(B, 'select event_presence($1) p', [BAILE])).p.count >= 3);
const frB = (await one(B, 'select event_friends($1) f', [BAILE])).f.map((p) => p.username);
ok('demo social: "quem tá indo" mostra público, esconde anônimo', frB.includes('lia.demo') && !frB.includes('nina.demo'), frB.join(','));
const sugB = (await one(C, 'select suggested_people(20) s')).s;
ok('demo social: Nina aparece como "Segue você"', sugB.some((x) => x.profile.username === 'nina.demo' && x.reason === 'Segue você'));
const inbB = (await one(B, 'select inbox() i')).i;
ok('demo social: direct com 1 de quem sigo e 1 solicitação', inbB.filter((c) => c.other?.is_demo).length === 2 && inbB.some((c) => c.iFollow && c.other.username === 'lia.demo') && inbB.some((c) => !c.iFollow && !c.replied && c.other.username === 'nina.demo'));
const grB = (await one(B, 'select my_groups() g')).g.filter((x) => x.name === 'Sextou no Baile')[0];
ok('demo social: convite no grupo com enquete', grB && grB.myStatus === 'invited' && grB.polls.length === 1 && grB.polls[0].votes.join() === '2,1,0');
ok('demo social: convidado ainda NÃO vê localização', (await one(B, "select group_locations_json('de06a000-0000-4000-8000-000000000001') l")).l.length === 0);
await as(B, "select respond_group('de06a000-0000-4000-8000-000000000001', 'going')");
ok('demo social: ao confirmar, vê Caio e Bia no mapa do grupo', (await one(B, "select group_locations_json('de06a000-0000-4000-8000-000000000001') l")).l.length === 2);
await db.query('select demo_refresh()');
ok('demo social: refresh mantém stories válidos', (await one(null, "select count(*)::int n from stories where expires_at > now() and author_id in (select id from profiles where is_demo)")).n === 8);
await db.query('select demo_purge()');
ok('demo_purge remove social (conversas, grupos, stories, follows)', (await one(null, `select (select count(*) from stories where id::text like 'de05f%')::int + (select count(*) from groups where id::text like 'de06a%')::int
  + (select count(*) from messages m join profiles p on p.id = m.sender_id where p.is_demo)::int
  + (select count(*) from follows where followee_id::text like 'de000000%' or follower_id::text like 'de000000%')::int n`)).n === 0);
ok('demo_purge remove tudo', (await one(null, 'select (select count(*) from profiles where is_demo)::int + (select count(*) from events where is_demo)::int + (select count(*) from posts where is_demo)::int n')).n === 0);

console.log(results.join('\n'));
console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
