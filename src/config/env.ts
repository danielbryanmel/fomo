/**
 * Variáveis públicas (EXPO_PUBLIC_*) são embutidas no bundle — só valores públicos.
 * Supabase: URL + chave PUBLICÁVEL (sb_publishable_…) ou a anon key legada.
 * NUNCA a secret/service_role key.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseKey);

/**
 * Como as pessoas entram:
 *  - `password` (padrão do beta): e-mail + senha. Funciona sem servidor de e-mail se
 *    "Confirm email" estiver desligado no Supabase — custo zero, ideal para testes com amigos.
 *  - `otp`: código de 6 dígitos por e-mail. Exige SMTP próprio (o SMTP embutido do
 *    Supabase só entrega para e-mails do time do projeto).
 */
export const authMode: 'password' | 'otp' = process.env.EXPO_PUBLIC_AUTH_MODE === 'otp' ? 'otp' : 'password';
