/** Barramento mínimo de eventos do app (ex.: feed recebe o post recém-criado). */
type Handler<T> = (payload: T) => void;

export function createBus<T>() {
  const handlers = new Set<Handler<T>>();
  return {
    emit: (payload: T) => handlers.forEach((h) => h(payload)),
    on: (h: Handler<T>) => {
      handlers.add(h);
      return () => {
        handlers.delete(h);
      };
    },
  };
}

import type { PostView } from '@/types/domain';
export const postCreated = createBus<PostView>();
export const postRemoved = createBus<string>();
