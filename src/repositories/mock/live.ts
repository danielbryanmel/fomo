/**
 * Mock do termômetro ao vivo. Espelha as regras documentadas em docs/DATA_MODEL.md (live_reports):
 *  - só relatos dos últimos LIVE_RULES.reportTtlMin minutos contam;
 *  - lotação só aparece com >= minReportsToShow relatos;
 *  - relato exige leitura única de localização a <= maxDistanceM do local;
 *  - cooldown por pessoa/evento.
 */
import { LIVE_RULES } from '@/config/live';
import * as db from '@/mocks/data';
import { distanceM } from '@/lib/geo';
import type { CrowdLevel, FomoEvent, LiveReport, LiveStatus } from '@/types/domain';
import type { LiveRepository } from '../types';

const ME = db.CURRENT_USER_ID;

function mode<T extends string>(values: T[]): T | null {
  if (!values.length) return null;
  const counts = new Map<T, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

export function isHappeningNow(e: FomoEvent, at = Date.now()) {
  const start = Date.parse(e.startsAt);
  const end = e.endsAt ? Date.parse(e.endsAt) : start + 6 * 3_600_000;
  return e.status === 'approved' && start <= at && end > at;
}

export function computeLiveStatus(eventId: string, at = Date.now()): LiveStatus {
  const cutoff = at - LIVE_RULES.reportTtlMin * 60_000;
  const recent = db.liveReports.filter((r) => r.eventId === eventId && Date.parse(r.createdAt) >= cutoff);
  const enough = recent.length >= LIVE_RULES.minReportsToShow;
  // mediana arredondada: robusta contra relatos isolados exagerados
  const sorted = recent.map((r) => r.crowd).sort((a, b) => a - b);
  const crowd = enough ? (sorted[Math.floor(sorted.length / 2)] as CrowdLevel) : null;
  const last = recent.reduce<string | null>((acc, r) => (!acc || r.createdAt > acc ? r.createdAt : acc), null);
  const tl = db.liveTimeline[eventId] ?? [];
  return {
    eventId,
    crowd,
    vibe: enough ? mode(recent.map((r) => r.vibe)) : null,
    music: enough ? mode(recent.map((r) => r.music).filter((m): m is NonNullable<typeof m> => m !== null)) : null,
    queue: enough ? mode(recent.map((r) => r.queue)) : null,
    reportsCount: recent.length,
    lastReportAt: last,
    timeline: tl.map((c, i) => ({ hour: `${(22 + i) % 24}h`, crowd: c })),
  };
}

export const mockLive: LiveRepository = {
  async status(eventId) {
    await new Promise((r) => setTimeout(r, 250));
    return computeLiveStatus(eventId);
  },
  async submit(input) {
    await new Promise((r) => setTimeout(r, 600));
    const e = db.events.find((x) => x.id === input.eventId);
    if (!e || !isHappeningNow(e)) throw new Error('Este rolê não está acontecendo agora.');
    const d = distanceM(input.location, { latitude: e.latitude, longitude: e.longitude });
    if (d > LIVE_RULES.maxDistanceM) {
      throw new Error(`Você parece estar a ${Math.round(d)} m do local. O relato só vale para quem está lá.`);
    }
    const cooldownCut = Date.now() - LIVE_RULES.cooldownMin * 60_000;
    if (db.liveReports.some((r) => r.userId === ME && r.eventId === e.id && Date.parse(r.createdAt) > cooldownCut)) {
      throw new Error(`Você já informou este rolê há pouco. Dá para atualizar em ${LIVE_RULES.cooldownMin} min.`);
    }
    const report: LiveReport = {
      id: `lr-me-${Date.now()}`,
      userId: ME,
      eventId: e.id,
      crowd: input.crowd,
      vibe: input.vibe,
      music: input.music,
      queue: input.queue,
      verification: 'one_time_location',
      createdAt: new Date().toISOString(),
    };
    db.liveReports.push(report);
    return {
      accepted: true,
      // XP fica "pendente" até o servidor validar (anti-farming); valor de exibição.
      xpPending: 10,
      expiresAt: new Date(Date.now() + LIVE_RULES.reportTtlMin * 60_000).toISOString(),
      // espelha submit_live_report: relato aceito no raio = check-in verificado (+20 XP no servidor)
      presenceVerified: true,
      presenceXp: 20,
    };
  },
};
