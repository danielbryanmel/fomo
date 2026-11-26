/** Lugares reais (tabela venues — só leitura, RLS pública). */
import { requireSupabase } from '@/lib/supabase/client';
import { distanceM } from '@/lib/geo';
import type { Venue } from '@/types/domain';
import type { VenuesRepository } from '../types';
import { friendlyError, toCategory, toEventView } from './mappers';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const sb = () => requireSupabase();
function check<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw friendlyError(r.error);
  return r.data;
}

export const toVenue = (r: Row): Venue => ({
  id: r.id, name: r.name, kind: r.kind, category: r.category ? toCategory(r.category) : null,
  neighborhood: r.neighborhood, address: r.address, latitude: r.latitude, longitude: r.longitude,
  geoPrecision: r.geo_precision, sourceUrl: r.source_url, checkedAt: r.checked_at,
});

export const venuesRepo: VenuesRepository = {
  async inBounds(b, origin) {
    const rows = check(await sb().from('venues').select('*, category:event_categories(*)')
      .gte('latitude', b.south).lte('latitude', b.north).gte('longitude', b.west).lte('longitude', b.east)
      .limit(200)) as Row[];
    return rows.map(toVenue).map((v) => ({ ...v, distanceM: origin ? Math.round(distanceM(origin, v)) : null }))
      .sort((a, z) => (a.distanceM ?? 0) - (z.distanceM ?? 0));
  },
  async getById(id) {
    const r = check(await sb().from('venues').select('*, category:event_categories(*)').eq('id', id).maybeSingle()) as Row | null;
    return r ? toVenue(r) : null;
  },
  async upcomingEvents(v) {
    const d = 0.0012; // ~120 m
    const rows = check(await sb().from('events').select('*, category:event_categories(*)')
      .eq('status', 'approved')
      .or(`venue_id.eq.${v.id},and(latitude.gte.${v.latitude - d},latitude.lte.${v.latitude + d},longitude.gte.${v.longitude - d},longitude.lte.${v.longitude + d})`)
      .gte('starts_at', new Date(Date.now() - 12 * 3600_000).toISOString())
      .order('starts_at').limit(10)) as Row[];
    return rows.map((r) => toEventView(r, false));
  },
};
