import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import type { Page } from '@/types/domain';

/** Lista paginada por cursor com refresh e carregamento incremental. */
export function usePaginated<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>, deps: DependencyList) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const gen = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = useCallback(fetchPage, deps);

  const reset = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const g = ++gen.current;
      mode === 'initial' ? setLoading(true) : setRefreshing(true);
      setError(null);
      try {
        const page = await fetcher(null);
        if (g !== gen.current) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      } catch (e) {
        if (g === gen.current) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (g === gen.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetcher],
  );

  useEffect(() => {
    setItems([]);
    void reset('initial');
  }, [reset]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !cursor) return;
    const g = gen.current;
    setLoadingMore(true);
    try {
      const page = await fetcher(cursor);
      if (g !== gen.current) return;
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor !== null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, fetcher, hasMore, loading, loadingMore]);

  return {
    items,
    setItems,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    loadMore,
    refresh: () => reset('refresh'),
    retry: () => reset('initial'),
  };
}
