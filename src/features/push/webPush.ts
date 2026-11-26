/**
 * Web Push (PWA). No iPhone só funciona com o app adicionado à Tela de Início (iOS 16.4+).
 * A chave VAPID PÚBLICA pode ficar no código; a privada fica só na Edge Function.
 */
import { Platform } from 'react-native';
import { requireSupabase } from '@/lib/supabase/client';
import { isIOSWeb } from '@/features/location/useLocation';

export const VAPID_PUBLIC_KEY = 'BGnltZsY7lzh9156bleJWx7ursa4BN8IUvVbP7bmUkSDwN5Uq1AMITD0hSDbFqnZG9ZO_lvj08j3F8h57AQngPk';

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
}

export async function pushState(): Promise<PushState> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unsupported';
  if (isIOSWeb() && !standalone()) return 'needs-install';
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Precisa ser chamado num toque (gesto) — o iPhone exige. */
export async function enablePush(): Promise<PushState> {
  const st = await pushState();
  if (st === 'unsupported' || st === 'needs-install' || st === 'denied') return st;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await registration();
  if (!reg) return 'unsupported';
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await requireSupabase().rpc('save_push_subscription', {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw new Error('Não foi possível ativar as notificações agora.');
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await requireSupabase().rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe().catch(() => {});
  }
  return 'off';
}

/** Mantém a inscrição do servidor em dia (troca de conta, renovação do navegador). Silencioso. */
export async function syncPush() {
  try {
    if ((await pushState()) !== 'on') return;
    const sub = await (await registration())?.pushManager.getSubscription();
    if (!sub) return;
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await requireSupabase().rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_user_agent: navigator.userAgent.slice(0, 300) });
  } catch {
    /* ignora */
  }
}

export async function setNudges(on: boolean) {
  const { error } = await requireSupabase().rpc('set_push_nudges', { p_on: on });
  if (error) throw new Error('Não foi possível salvar.');
}
export type Pronoun = 'ele' | 'ela' | null;
export async function getPushPrefs(): Promise<{ nudges: boolean; pronoun: Pronoun }> {
  const sb = requireSupabase();
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return { nudges: true, pronoun: null };
  const { data } = await sb.from('profiles').select('push_nudges, pronoun').eq('id', s.session.user.id).single();
  const d = data as { push_nudges?: boolean; pronoun?: Pronoun } | null;
  return { nudges: d?.push_nudges ?? true, pronoun: d?.pronoun ?? null };
}
/** Só escolhe o texto das cutucadas ("sua namorada" / "seu namorado"). Opcional. */
export async function setPronoun(p: Pronoun) {
  const { error } = await requireSupabase().rpc('set_pronoun', { p_pronoun: p });
  if (error) throw new Error('Não foi possível salvar.');
}
