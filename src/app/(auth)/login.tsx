import type { ReactNode } from 'react';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FomoLockup } from '@/components/brand/FomoLockup';
import { FomoMark } from '@/components/brand/FomoMark';
import { Appear } from '@/components/motion';
import { Ambient, Button, Screen, Text } from '@/components/ui';
import { authMode } from '@/config/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, hitTarget, radius, spacing, typography } from '@/theme';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/**
 * Entrada no app. Dois modos (config/env.ts › authMode):
 *  - senha (beta gratuito, não depende de envio de e-mail)
 *  - código de 6 dígitos por e-mail (produção, com SMTP próprio)
 */
export default function LoginScreen() {
  return authMode === 'otp' ? <OtpLogin /> : <PasswordLogin />;
}

function Shell({ subtitle, children, footer }: { subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.root}>
      <Ambient variant="center" intensity={0.9} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.top}><FomoLockup size={24} /></View>
        <View style={styles.center}>
          <Appear kind="zoom"><FomoMark size={88} variant="glass" /></Appear>
          <Appear delay={80}><Text variant="hero" align="center">De olho no rolê.</Text></Appear>
          <Appear delay={140}><Text tone="secondary" align="center">{subtitle}</Text></Appear>
          <Appear delay={200} style={styles.fields}>{children}</Appear>
        </View>
        <View style={styles.bottom}>
          {footer}
          <Text variant="caption" tone="muted" align="center">Versão de testes. Ao continuar, você concorda com os Termos e a Política de Privacidade.</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function PasswordLogin() {
  const auth = useAuth();
  const [mode, setMode] = useState<'signUp' | 'signIn'>('signUp');
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      subtitle={mode === 'signUp' ? 'Crie sua conta em 10 segundos.' : 'Bom te ver de volta.'}
      footer={
        <>
          <Button label={mode === 'signUp' ? 'Criar conta' : 'Entrar'} fullWidth loading={busy} disabled={!canSubmit} onPress={submit} />
          <Button
            label={mode === 'signUp' ? 'Já tenho conta' : 'Criar uma conta nova'}
            variant="ghost"
            onPress={() => { setMode(mode === 'signUp' ? 'signIn' : 'signUp'); setError(null); setInfo(null); }}
          />
        </>
      }
    >
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
          <Text variant="mono" tone="secondary">{show ? 'ocultar' : 'mostrar'}</Text>
        </Pressable>
      </View>
      {mode === 'signUp' && password.length > 0 && !strongEnough ? (
        <Text variant="caption" tone="muted">Use pelo menos 8 caracteres, com letras e números.</Text>
      ) : null}
      {error ? <Text tone="danger" align="center" accessibilityRole="alert">{error}</Text> : null}
      {info ? <Text tone="live" align="center" accessibilityRole="alert">{info}</Text> : null}
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
  top: { paddingTop: spacing.sm },
  center: { alignItems: 'center', gap: spacing.lg, maxWidth: 420, width: '100%', alignSelf: 'center' },
  fields: { width: '100%', gap: spacing.md },
  input: {
    width: '100%', minHeight: hitTarget + 8, paddingHorizontal: spacing.lg, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, color: colors.text,
    // 16px+ evita o zoom automático do Safari no iPhone ao focar
    fontSize: Math.max(16, typography.headline.fontSize),
  },
  pwd: { paddingRight: 92 },
  eye: { position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: spacing.sm },
  code: { textAlign: 'center', letterSpacing: 10, fontSize: 26, fontWeight: '700' },
  bottom: { gap: spacing.sm, maxWidth: 420, width: '100%', alignSelf: 'center' },
});
