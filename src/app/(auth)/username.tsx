import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Ambient, Button, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, hitTarget, radius, spacing, typography } from '@/theme';

/** Primeiro acesso: @ único + nome de exibição. Perfil nasce público (decisão V2). */
export default function UsernameScreen() {
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[a-z0-9_.]{3,30}$/.test(username);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await auth.claimUsername(username, name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.root}>
      <Ambient variant="top" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text variant="mono" tone="muted">quase lá</Text>
          <Text variant="display">Como vão te achar?</Text>
          <Text variant="mono" tone="muted" style={styles.label}>seu @</Text>
          <View style={styles.inputRow}>
            <Text variant="headline" tone="muted">@</Text>
            <TextInput
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 30))}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              placeholder="seu.usuario"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              accessibilityLabel="Nome de usuário"
            />
          </View>
          <Text variant="caption" tone="muted">3 a 30 caracteres: letras minúsculas, números, ponto e _.</Text>
          <Text variant="mono" tone="muted" style={styles.label}>nome de exibição</Text>
          <TextInput value={name} onChangeText={(t) => setName(t.slice(0, 50))} placeholder="Como você quer aparecer" placeholderTextColor={colors.textMuted} style={[styles.inputRow, styles.input]} accessibilityLabel="Nome de exibição" />
          <Text variant="caption" tone="muted">Seu perfil começa público. Dá para deixar privado depois.</Text>
          {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
        </View>
        <Button label="Continuar" fullWidth loading={busy} disabled={!valid} onPress={save} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: spacing.lg },
  flex: { flex: 1, justifyContent: 'space-between' },
  content: { gap: spacing.sm, paddingTop: spacing.xxl },
  label: { marginTop: spacing.lg },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: hitTarget + 8, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  input: { flex: 1, color: colors.text, fontSize: typography.headline.fontSize },
});
