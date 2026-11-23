/**
 * Registro de erros do app → tabela client_errors (via RPC com limite no servidor).
 * Manda só o técnico: mensagem, tela, aparelho e versão. Tira e-mails e tokens do texto.
 * Sem Supabase configurado (modo demonstração) não manda nada.
 */
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase/client';

const APP_VERSION = '0.1.0';
let currentRoute = '';
const recent = new Map<string, number>();

export function setErrorRoute(route: string) {
  currentRoute = route;
}

function scrub(s: string) {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/(access_token|refresh_token|apikey|password)=[^&\s]+/gi, '$1=[oculto]');
}

function route() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.pathname;
  return currentRoute;
}

export function reportProblem(kind: 'error' | 'feedback', message: string, detail?: string) {
  if (!supabase || !message) return;
  const msg = scrub(String(message)).slice(0, 2000);
  // mesmo erro repetido em menos de 1 min: manda uma vez só
  const key = `${kind}:${msg}`;
  const now = Date.now();
  if (kind === 'error' && (recent.get(key) ?? 0) > now - 60_000) return;
  recent.set(key, now);
  const ua = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : `${Platform.OS} ${String(Platform.Version)}`;
  void supabase
    .rpc('report_client_error', {
      p_kind: kind, p_message: msg, p_route: route(), p_detail: detail ? scrub(detail).slice(0, 4000) : null,
      p_user_agent: ua.slice(0, 300), p_app_version: APP_VERSION,
    })
    .then(() => {}, () => {});
}

export function reportError(e: unknown, context?: string) {
  const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : JSON.stringify(e)?.slice(0, 500) ?? 'erro');
  reportProblem('error', context ? `${context}: ${err.message}` : err.message, err.stack);
}

let installed = false;
/** Pega erros que escapam de tudo (JS quebrado, promessa sem tratamento). */
export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (ev) => {
      // ignora falha de imagem/arquivo externo (ex.: tiles do mapa sem internet)
      if (!(ev as ErrorEvent).message) return;
      reportError((ev as ErrorEvent).error ?? (ev as ErrorEvent).message, 'janela');
    });
    window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason, 'promessa'));
    return;
  }
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const prev = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((e, fatal) => {
    reportError(e, fatal ? 'fatal' : 'global');
    prev?.(e, fatal);
  });
}
