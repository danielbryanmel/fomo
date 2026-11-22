import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured } from '@/config/env';
import { supabase } from '@/lib/supabase/client';
import { friendlyError, toProfile } from '@/repositories/supabase/mappers';
import type { UserProfile } from '@/types/domain';

/**
 * Estados:
 *  - 'mock'      → sem Supabase configurado: app em modo demonstração (sem login)
 *  - 'loading'   → lendo sessão salva
 *  - 'signedOut' → precisa entrar
 *  - 'needsProfile' → logado, mas ainda sem @username
 *  - 'ready'     → logado com perfil
 */
export type AuthStatus = 'mock' | 'loading' | 'signedOut' | 'needsProfile' | 'ready';

type AuthCtx = {
  status: AuthStatus;
  session: Session | null;
  profile: UserProfile | null;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  /** Entrar ou criar conta com senha. Retorna 'confirm' se o projeto exigir confirmação por e-mail. */
  passwordAuth: (mode: 'signIn' | 'signUp', email: string, password: string) => Promise<'ok' | 'confirm'>;
  claimUsername: (username: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'mock');

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!supabase) return;
    if (!s) {
      setProfile(null);
      setStatus('signedOut');
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile(data ? toProfile(data) : null);
    setStatus(data ? 'ready' : 'needsProfile');
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadProfile(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<AuthCtx>(
    () => ({
      status,
      session,
      profile,
      async sendCode(email) {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
        if (error) throw new Error(/rate/i.test(error.message) ? 'Muitas tentativas. Aguarde um minuto.' : 'Não foi possível enviar o código. Confira o e-mail.');
      },
      async verifyCode(email, code) {
        if (!supabase) return;
        const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
        if (error) throw new Error('Código inválido ou expirado.');
      },
      async passwordAuth(mode, email, password) {
        if (!supabase) return 'ok';
        const creds = { email: email.trim().toLowerCase(), password };
        if (mode === 'signIn') {
          const { error } = await supabase.auth.signInWithPassword(creds);
          if (error) {
            if (/confirm/i.test(error.message)) throw new Error('Confirme seu e-mail antes de entrar.');
            throw new Error(/rate/i.test(error.message) ? 'Muitas tentativas. Aguarde um minuto.' : 'E-mail ou senha incorretos.');
          }
          return 'ok';
        }
        const { data, error } = await supabase.auth.signUp(creds);
        if (error) {
          const m = error.message.toLowerCase();
          if (m.includes('already') || m.includes('registered')) throw new Error('Esse e-mail já tem conta. Toque em "Já tenho conta".');
          if (m.includes('password')) throw new Error('Senha fraca: use pelo menos 8 caracteres, com letras e números.');
          if (m.includes('rate')) throw new Error('Muitas tentativas. Aguarde um minuto.');
          if (m.includes('not authorized') || m.includes('email')) throw new Error('Cadastro por e-mail indisponível agora. Avise quem te convidou.');
          throw new Error('Não foi possível criar a conta agora.');
        }
        return data.session ? 'ok' : 'confirm';
      },
      async claimUsername(username, displayName) {
        if (!supabase) return;
        const { data, error } = await supabase.rpc('claim_profile', { p_username: username, p_display_name: displayName });
        if (error) throw friendlyError(error);
        setProfile(toProfile(data));
        setStatus('ready');
      },
      async signOut() {
        await supabase?.auth.signOut();
      },
      async refreshProfile() {
        await loadProfile(session);
      },
    }),
    [status, session, profile, loadProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
