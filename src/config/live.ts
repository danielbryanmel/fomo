import type { CrowdLevel, MusicLevel, QueueLevel, VibeLevel } from '@/types/domain';

/**
 * Regras do termômetro — CÓPIA DE EXIBIÇÃO. Fonte de verdade: tabela de configuração no backend.
 */
export const LIVE_RULES = {
  /** Relato vale por 90 min ("relato velho não vale"). */
  reportTtlMin: 90,
  /** Mínimo de relatos recentes para exibir a lotação (evita 1 pessoa definir o lugar). */
  minReportsToShow: 3,
  /** Distância máxima até o local para aceitar o relato (leitura única de GPS). */
  maxDistanceM: 200,
  /** Um relato por pessoa por evento a cada N minutos. */
  cooldownMin: 30,
} as const;

export const CROWD_LABEL: Record<CrowdLevel, string> = { 1: 'Tranquilo', 2: 'Animado', 3: 'Cheio', 4: 'Lotado' };
export const VIBE_LABEL: Record<VibeLevel, string> = { chato: 'Chato', ok: 'Ok', bom: 'Bom', bombando: 'Bombando' };
export const MUSIC_LABEL: Record<MusicLevel, string> = { ruim: 'Ruim', ok: 'Ok', bom: 'Bom', sem_som: 'Sem som' };
export const QUEUE_LABEL: Record<QueueLevel, string> = { sem_fila: 'Sem fila', curta: 'Curta', media: 'Média', longa: 'Longa' };
export const QUEUE_HINT: Record<QueueLevel, string> = { sem_fila: 'entra direto', curta: '~10 min', media: '~25 min', longa: '40+ min' };
