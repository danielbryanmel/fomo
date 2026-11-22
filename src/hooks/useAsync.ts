import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export type AsyncState<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  setData: (updater: (prev: T | undefined) => T | undefined) => void;
};

/** Carrega dados com estados de loading/erro/refresh. Ignora respostas de requisições obsoletas. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setDataState] = useState<T>();
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const reqId = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const load = useCallback(
    async (isRefresh: boolean) => {
      const id = ++reqId.current;
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const result = await run();
        if (id === reqId.current) setDataState(result);
      } catch (e) {
        if (id === reqId.current) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [run],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // estáveis entre renders: podem ir em deps de efeitos/useFocusEffect sem loop
  const refresh = useCallback(() => load(true), [load]);
  const setData = useCallback((updater: (prev: T | undefined) => T | undefined) => setDataState((prev) => updater(prev)), []);

  return { data, error, loading, refreshing, refresh, setData };
}
