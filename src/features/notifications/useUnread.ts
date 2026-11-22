import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { repositories } from '@/repositories';

/** Contador de não lidas: atualiza ao focar a tela e em tempo real (Supabase Realtime). */
export function useUnread() {
  const [count, setCount] = useState(0);
  const load = useCallback(() => {
    repositories.social.unreadCount().then(setCount).catch(() => {});
  }, []);
  useFocusEffect(load);
  useEffect(() => repositories.social.subscribe(load), [load]);
  return count;
}
