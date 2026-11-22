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
    await db.exec('reset role');
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
await db.query('select demo_purge()');
ok('demo_purge remove tudo', (await one(null, 'select (select count(*) from profiles where is_demo)::int + (select count(*) from events where is_demo)::int + (select count(*) from posts where is_demo)::int n')).n === 0);

console.log(results.join('\n'));
console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
