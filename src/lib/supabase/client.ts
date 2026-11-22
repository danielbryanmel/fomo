import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { env, isSupabaseConfigured } from '@/config/env';
import { authStorage } from './authStorage';

/**
 * Cliente Supabase (chave PUBLICÁVEL — segura no app; a segurança vem da RLS).
 * null quando o .env não está configurado → o app roda com dados mock.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseKey, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Renovação de token só com o app em primeiro plano (recomendação do guia Expo).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}
