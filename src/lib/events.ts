import type { FomoEvent } from '@/types/domain';

/** Mesmo critério do backend (exibição). */
export function isHappeningNow(e: Pick<FomoEvent, 'status' | 'startsAt' | 'endsAt'>, at = Date.now()) {
  const start = Date.parse(e.startsAt);
  const end = e.endsAt ? Date.parse(e.endsAt) : start + 6 * 3_600_000;
  return e.status === 'approved' && start <= at && end > at;
}

/** "ATÉ 05H" / "21H–02H" */
export function formatHours(e: Pick<FomoEvent, 'startsAt' | 'endsAt'>, now = Date.now()) {
  const h = (iso: string) => `${String(new Date(iso).getHours()).padStart(2, '0')}h`;
  if (Date.parse(e.startsAt) <= now && e.endsAt) return `até ${h(e.endsAt)}`;
  return e.endsAt ? `${h(e.startsAt)}–${h(e.endsAt)}` : `a partir das ${h(e.startsAt)}`;
}
