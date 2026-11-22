const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "hoje · 23:00", "amanhã · 20:00", "sex, 28 nov · 21:00" */
export function formatEventDate(isoDate: string, now = new Date()) {
  const d = new Date(isoDate);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(now)) / 86_400_000);
  if (diffDays === 0) return `hoje · ${time}`;
  if (diffDays === 1) return `amanhã · ${time}`;
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} · ${time}`;
}

/** Data sem hora ("2026-11-22") é lida como data LOCAL — new Date() a trataria como UTC e voltaria um dia. */
function parseDay(isoDate: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(isoDate);
}

export function formatDay(isoDate: string) {
  const d = parseDay(isoDate);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "agora", "12 min", "3 h", "2 d", "5 nov" */
export function formatRelative(isoDate: string, now = Date.now()) {
  const s = Math.max(0, (now - Date.parse(isoDate)) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d`;
  const d = new Date(isoDate);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** 980 → "980"; 1530 → "1,5 mil"; 2_400_000 → "2,4 mi" */
export function formatCount(n: number) {
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${fmt(n / 1000)} mil`;
  return `${fmt(n / 1_000_000)} mi`;
}

export function formatPrice(minCents: number | null, maxCents: number | null) {
  if (minCents === null && maxCents === null) return 'Preço não informado';
  const brl = (c: number) => `R$ ${(c / 100).toFixed(0)}`;
  const min = minCents ?? maxCents ?? 0;
  const max = maxCents ?? min;
  if (max === 0) return 'Gratuito';
  if (min === max) return brl(min);
  return `${brl(min)} – ${brl(max)}`;
}
