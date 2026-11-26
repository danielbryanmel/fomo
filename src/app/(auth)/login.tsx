import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FomoLockup } from '@/components/brand/FomoLockup';
import { Check, Eye, EyeOff } from 'lucide-react-native';
import { Appear } from '@/components/motion';
import { Button, familyFor, Screen, Text } from '@/components/ui';
import { authMode } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, spacing, typography } from '@/theme';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/**
 * Entrada no app. Dois modos (config/env.ts › authMode):
 *  - senha (beta gratuito, não depende de envio de e-mail)
 *  - código de 6 dígitos por e-mail (produção, com SMTP próprio)
 */
export default function LoginScreen() {
  return authMode === 'otp' ? <OtpLogin /> : <PasswordLogin />;
}

function Shell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.center}>
          <View style={styles.top}><FomoLockup size={26} /></View>
          <Appear delay={60}><Text variant="brand" accessibilityRole="header">{title}</Text></Appear>
          <Appear delay={120}><Text tone="secondary" style={{ fontSize: 17, lineHeight: 24 }}>{subtitle}</Text></Appear>
          <Appear delay={180} style={styles.fields}>{children}</Appear>
        </View>
        <View style={styles.bottom}>
          {footer}
          <Text variant="caption" tone="muted" align="center">Versão de testes. Ao continuar, você concorda com os Termos e a Política de Privacidade.</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const HAS_ACCOUNT_KEY = 'fomo.hasAccount.v1';
/** Quem já entrou neste aparelho volta direto para "Entrar" (antes caía em "Criar conta" e travava). */
function hadAccount() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(HAS_ACCOUNT_KEY) === '1';
  } catch {
    return false;
  }
}
function rememberAccount() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(HAS_ACCOUNT_KEY, '1');
  } catch {
    /* ignora */
  }
}

function PasswordLogin() {
  const auth = useAuth();
  const [mode, setMode] = useState<'signUp' | 'signIn' | 'reset'>(() => (hadAccount() ? 'signIn' : 'signUp'));
  if (mode === 'reset') return <ResetPassword onBack={() => setMode('signIn')} />;
  return <PasswordForm mode={mode} setMode={setMode} auth={auth} />;
}

function PasswordForm({ mode, setMode, auth }: { mode: 'signUp' | 'signIn'; setMode: (m: 'signUp' | 'signIn' | 'reset') => void; auth: ReturnType<typeof useAuth> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const strongEnough = password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
  const canSubmit = isEmail(email) && (mode === 'signIn' ? password.length >= 6 : strongEnough);

  async function submit() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await auth.passwordAuth(mode, email, password);
      if (r === 'confirm') setInfo('Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.');
      else rememberAccount();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      // e-mail já cadastrado com outra senha: muda para "Entrar" para mostrar "Esqueci minha senha"
      if (mode === 'signUp' && /já tem conta/.test(msg)) setMode('signIn');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title={mode === 'signUp' ? 'Cria sua conta.' : 'Bom te ver de volta.'}
      subtitle={mode === 'signUp' ? 'Leva 10 segundos.' : 'Entra pra ver onde tá bom agora.'}
      footer={
        <>
          <Button label={mode === 'signUp' ? 'Criar conta' : 'Entrar'} fullWidth loading={busy} disabled={!canSubmit} onPress={submit} />
          <Button
            label={mode === 'signUp' ? 'Já tenho conta' : 'Criar uma conta nova'}
            variant="ghost"
            onPress={() => { setMode(mode === 'signUp' ? 'signIn' : 'signUp'); setError(null); setInfo(null); }}
          />
          {mode === 'signIn' ? <Button label="Esqueci minha senha" variant="ghost" onPress={() => setMode('reset')} /> : null}
          {error ? <Button label="Problema para entrar? Avise a gente" variant="ghost" onPress={() => router.push('/feedback')} /> : null}
        </>
      }
    >
      <Text style={styles.label}>E-mail</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="voce@email.com"
        placeholderTextColor={colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        style={styles.input}
        accessibilityLabel="E-mail"
      />
      <Text style={styles.label}>Senha</Text>
      <View>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'signUp' ? 'Crie uma senha (8+ com letras e números)' : 'Sua senha'}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
          style={[styles.input, styles.pwd]}
          onSubmitEditing={() => canSubmit && submit()}
          accessibilityLabel="Senha"
        />
        <Pressable onPress={() => setShow((v) => !v)} style={styles.eye} accessibilityRole="button" accessibilityLabel={show ? 'Ocultar senha' : 'Mostrar senha'}>
          {show ? <EyeOff size={22} color={colors.textSecondary} /> : <Eye size={22} color={colors.textSecondary} />}
        </Pressable>
      </View>
      {mode === 'signUp' && password.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <Rule ok={password.length >= 8} label="8 ou mais caracteres" />
          <Rule ok={/[a-zA-Z]/.test(password) && /\d/.test(password)} label="letras e números" />
        </View>
      ) : null}
      {error ? <Text tone="danger" align="center" accessibilityRole="alert">{error}</Text> : null}
      {info ? <Text tone="live" align="center" accessibilityRole="alert">{info}</Text> : null}
    </Shell>
  );
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Check size={14} color={ok ? colors.live : colors.textMuted} strokeWidth={2.6} />
      <Text variant="caption" style={{ color: ok ? colors.live : colors.textMuted, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function ResetPassword({ onBack }: { onBack: () => void }) {
  const auth = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strong = password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Esqueceu a senha?"
      subtitle={step === 'email' ? 'Manda seu e-mail que a gente envia um código de 6 dígitos.' : `Digite o código enviado para ${email.trim()} e a nova senha.`}
      footer={
        <>
          {step === 'email' ? (
            <Button label="Enviar código" fullWidth loading={busy} disabled={!isEmail(email)} onPress={() => run(async () => { await auth.sendResetCode(email); setStep('code'); })} />
          ) : (
            <Button label="Trocar senha e entrar" fullWidth loading={busy} disabled={code.length !== 6 || !strong} onPress={() => run(() => auth.resetWithCode(email, code, password))} />
          )}
          <Button label="Voltar para entrar" variant="ghost" onPress={onBack} />
        </>
      }
    >
      {step === 'email' ? (
        <TextInput value={email} onChangeText={setEmail} placeholder="voce@email.com" placeholderTextColor={colors.textMuted} keyboardType="email-address"
          autoCapitalize="none" autoComplete="email" textContentType="emailAddress" style={styles.input} accessibilityLabel="E-mail" />
      ) : (
        <>
          <TextInput value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} placeholder="000000" placeholderTextColor={colors.textMuted}
            keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" style={[styles.input, styles.code]} accessibilityLabel="Código de 6 dígitos" />
          <TextInput value={password} onChangeText={setPassword} placeholder="Nova senha (8+ com letras e números)" placeholderTextColor={colors.textMuted}
            secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" style={styles.input} accessibilityLabel="Nova senha" />
        </>
      )}
      {error ? <Text tone="danger" align="center" accessibilityRole="alert">{error}</Text> : null}
    </Shell>
  );
}

function OtpLogin() {
  const auth = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="De olho no rolê."
      subtitle={step === 'email' ? 'Entre com seu e-mail. Mandamos um código — sem senha.' : `Digite o código enviado para ${email.trim()}.`}
      footer={
        step === 'email' ? (
          <Button label="Receber código" fullWidth loading={busy} disabled={!isEmail(email)} onPress={() => run(async () => { await auth.sendCode(email); setStep('code'); })} />
        ) : (
          <>
            <Button label="Entrar" fullWidth loading={busy} disabled={code.length !== 6} onPress={() => run(() => auth.verifyCode(email, code))} />
            <Button label="Usar outro e-mail" variant="ghost" onPress={() => { setStep('email'); setCode(''); setError(null); }} />
          </>
        )
      }
    >
      {step === 'email' ? (
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="voce@email.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          style={styles.input}
          accessibilityLabel="E-mail"
        />
      ) : (
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          style={[styles.input, styles.code]}
          accessibilityLabel="Código de 6 dígitos"
        />
      )}
      {error ? <Text tone="danger" align="center" accessibilityRole="alert">{error}</Text> : null}
    </Shell>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: spacing.lg },
  flex: { flex: 1, justifyContent: 'space-between' },
  top: { paddingTop: spacing.sm, marginBottom: spacing.xxl },
  center: { gap: spacing.md, maxWidth: 480, width: '100%', alignSelf: 'center' },
  fields: { width: '100%', gap: spacing.sm, marginTop: spacing.lg },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.sm },
  input: {
    width: '100%', minHeight: 54, paddingHorizontal: spacing.lg, borderRadius: 14, fontFamily: familyFor('400'),
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, color: colors.text,
    // 16px+ evita o zoom automático do Safari no iPhone ao focar
    fontSize: Math.max(16, typography.headline.fontSize),
  },
  pwd: { paddingRight: 92 },
  eye: { position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: spacing.sm },
  code: { textAlign: 'center', letterSpacing: 10, fontSize: 26, fontWeight: '700' },
  bottom: { gap: spacing.sm, maxWidth: 480, width: '100%', alignSelf: 'center' },
});
