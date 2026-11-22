import type { LevelDefinition } from '@/types/domain';

/**
 * Tabela de níveis — CÓPIA DE EXIBIÇÃO / fallback offline.
 * A fonte de verdade é a tabela `level_definitions` no backend (configurável).
 * O cliente nunca calcula XP nem promove nível: só lê `profiles.level` / `profiles.xp`.
 * Limiares de minXp são iniciais e serão ajustados com dados reais.
 */
export const LEVELS: readonly LevelDefinition[] = [
  { level: 1, name: 'Novato', minXp: 0 },
  { level: 2, name: 'Saideiro', minXp: 100 },
  { level: 3, name: 'Rato do Rolê', minXp: 300 },
  { level: 4, name: 'Explorador Noturno', minXp: 700 },
  { level: 5, name: 'Lenda da Madrugada', minXp: 1500 },
  { level: 6, name: 'Insider', minXp: 3000 },
  { level: 7, name: 'Lenda do FOMO', minXp: 6000 },
] as const;

export function levelProgress(xp: number, levels: readonly LevelDefinition[] = LEVELS) {
  const sorted = [...levels].sort((a, b) => a.minXp - b.minXp);
  let current = sorted[0]!;
  for (const l of sorted) if (xp >= l.minXp) current = l;
  const next = sorted.find((l) => l.minXp > current.minXp) ?? null;
  const progress = next ? (xp - current.minXp) / (next.minXp - current.minXp) : 1;
  return { current, next, progress: Math.min(1, Math.max(0, progress)) };
}
