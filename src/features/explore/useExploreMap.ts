import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { regionToBounds, type Region } from '@/lib/geo';
import { repositories } from '@/repositories';
import type { GeoPoint, MapEvent } from '@/types/domain';
import { DEFAULT_FILTERS, type ExploreFilters } from './FilterSheet';

/**
 * Estado do Explorar: região visível, filtros e resultados.
 * A consulta é sempre limitada à área visível (bounding box) e refeita com debounce
 * quando o mapa para de mover — nunca carrega todos os eventos.
 */
export function useExploreMap(initialRegion: Region, origin: GeoPoint | null) {
  const [region, setRegion] = useState(initialRegion);
  const [category, setCategory] = useState<string | null>(null);
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const req = useRef(0);

  // Origem ausente invalida filtro de distância
  const effectiveFilters = useMemo(() => (origin ? filters : { ...filters, maxDistanceKm: null }), [filters, origin]);

  const load = useCallback(async () => {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    try {
      // margem de 20% para pins na borda não "piscarem" ao arrastar
      const pad = { ...region, latitudeDelta: region.latitudeDelta * 1.2, longitudeDelta: region.longitudeDelta * 1.2 };
      const list = await repositories.events.listForMap({
        bounds: regionToBounds(pad),
        origin,
        categorySlug: category,
        date: effectiveFilters.date,
        maxDistanceKm: effectiveFilters.maxDistanceKm,
        price: effectiveFilters.price,
        query,
      });
      if (id === req.current) setEvents(list);
    } catch (e) {
      if (id === req.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [region, origin, category, effectiveFilters, query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const liveCount = events.filter((e) => (e.live?.crowd ?? 0) >= 3).length;

  return {
    region, setRegion,
    category, setCategory,
    filters, setFilters,
    query, setQuery,
    events, loading, error, retry: load,
    liveCount,
  };
}
