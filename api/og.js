/**
 * Prévia de link (WhatsApp, Instagram, Telegram, X…) para rolês e publicações.
 * O app é uma SPA: os robôs de prévia não executam JS, então o vercel.json manda SÓ
 * esses robôs para cá (pelo user-agent). Pessoas continuam indo direto para o app.
 * Lê apenas dados públicos com a chave publicável (RLS vale igual ao app).
 */
const SB_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const UUID = /^[0-9a-f-]{36}$/i;

async function rest(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) return null;
  const j = await r.json();
  return Array.isArray(j) ? j[0] ?? null : j;
}

function when(iso) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      .format(new Date(iso)).replace('.', '');
  } catch {
    return '';
  }
}

module.exports = async (req, res) => {
  const { type, id } = req.query;
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  let title = 'FOMO · de olho no rolê';
  let desc = 'Onde está bom agora? Mapa da noite, relatos ao vivo e o rolê de quem você segue.';
  let path = '/';
  try {
    if (SB_URL && SB_KEY && UUID.test(id || '')) {
      if (type === 'event') {
        const e = await rest(`events?id=eq.${id}&select=title,venue_name,starts_at,description,is_demo`);
        if (e) {
          title = `${e.title}${e.venue_name ? ` · ${e.venue_name}` : ''}`;
          desc = `${when(e.starts_at)}${e.is_demo ? ' · demonstração' : ''} — ${(e.description || 'Veja quem vai e como tá agora no FOMO.').slice(0, 160)}`;
          path = `/event/${id}`;
        }
      } else if (type === 'post') {
        const p = await rest(`posts?id=eq.${id}&select=body,place_name,author:profiles!posts_author_id_fkey(username)`);
        if (p) {
          title = `@${p.author?.username ?? 'alguém'}${p.place_name ? ` em ${p.place_name}` : ''} · FOMO`;
          desc = (p.body || 'Fotos do rolê no FOMO.').slice(0, 180);
          path = `/post/${id}`;
        }
      }
    }
  } catch {
    /* cai na prévia padrão */
  }
  const url = `${origin}${path}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="FOMO">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${origin}/og.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(url)}"></head>
<body><a href="${esc(url)}">${esc(title)}</a></body></html>`);
};
