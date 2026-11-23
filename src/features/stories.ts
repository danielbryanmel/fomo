import type { StoryGroup } from '@/types/domain';

/**
 * Cache da bandeja de stories: o visualizador abre na hora com o que a bandeja já carregou
 * (sem refazer a consulta nem as URLs assinadas).
 */
let tray: StoryGroup[] = [];
const listeners = new Set<() => void>();

export const storyCache = {
  get: () => tray,
  set(groups: StoryGroup[]) {
    tray = groups;
  },
  /** Marca como vistos localmente (a bandeja perde o anel na hora). */
  markSeen(storyId: string) {
    tray = tray.map((g) => {
      if (!g.stories.some((s) => s.id === storyId)) return g;
      const stories = g.stories.map((s) => (s.id === storyId ? { ...s, seen: true } : s));
      return { ...g, stories, hasUnseen: stories.some((s) => !s.seen) && g.hasUnseen };
    });
    listeners.forEach((fn) => fn());
  },
  /** Avisa quem mostra a bandeja que algo mudou (novo story, story apagado). */
  changed() {
    listeners.forEach((fn) => fn());
  },
  on(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};
