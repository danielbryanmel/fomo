// Entrega a fila de push (push_queue) via Web Push. Chamada só pelo cron do banco (cabeçalho x-cron-secret).
// Segredos (chave VAPID privada, segredo do cron) ficam no Vault do banco — nunca no app nem no código.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUBJECT = 'https://fomo-ten-tau.vercel.app';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req: Request) => {
  const { data: cfg } = await db.rpc('push_config');
  const secret = cfg?.cron_secret as string | undefined;
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 });
  webpush.setVapidDetails(SUBJECT, cfg.vapid_public, cfg.vapid_private);

  const { data: rows, error } = await db.rpc('push_claim', { p_limit: 200 });
  if (error) return new Response(error.message, { status: 500 });

  const sent = new Set<number>();
  const gone: string[] = [];
  const okSubs: string[] = [];
  await Promise.all(
    (rows ?? []).map(async (r: { queue_id: number; sub_id: string; endpoint: string; p256dh: string; auth: string; title: string; body: string; url: string; tag: string | null; image: string | null }) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: r.tag ?? undefined, image: r.image ?? undefined }),
          { TTL: 60 * 60 * 6, urgency: r.tag === 'nudge' ? 'normal' : 'high' },
        );
        sent.add(r.queue_id);
        okSubs.push(r.sub_id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { gone.push(r.sub_id); sent.add(r.queue_id); }
      }
    }),
  );
  // itens sem nenhuma inscrição válida também saem da fila
  for (const r of rows ?? []) if (gone.includes(r.sub_id)) sent.add(r.queue_id);
  await db.rpc('push_done', { p_sent: [...sent], p_gone: gone, p_ok: okSubs });
  return Response.json({ sent: sent.size, gone: gone.length });
});
