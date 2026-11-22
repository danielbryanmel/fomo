import { isSupabaseConfigured } from '@/config/env';
import { mockRepositories } from './mock';
import { supabaseRepositories } from './supabase';
import type { Repositories } from './types';

/**
 * Ponto único de troca de implementação:
 *  - .env com EXPO_PUBLIC_SUPABASE_URL + PUBLISHABLE_KEY → Supabase (dados reais, RLS);
 *  - sem .env → mock (demonstração / prévia Web).
 */
export const DATA_SOURCE: 'mock' | 'supabase' = isSupabaseConfigured ? 'supabase' : 'mock';
export const repositories: Repositories = DATA_SOURCE === 'supabase' ? supabaseRepositories : mockRepositories;

export type * from './types';
