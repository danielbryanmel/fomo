import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Field } from '@/components/form/Field';
import { Button, Chip, Screen, Text, useToast } from '@/components/ui';
import { reportProblem } from '@/lib/errorReporter';
import { colors, radius, spacing } from '@/theme';

const KINDS = [
  { key: 'bug', label: 'Algo não funcionou' },
  { key: 'ideia', label: 'Tenho uma ideia' },
  { key: 'outro', label: 'Outra coisa' },
] as const;
const WHERE = ['Mapa', 'Rolê / check-in', 'Postar', 'Stories', 'Feed', 'Direct', 'Grupos', 'Perfil', 'Login', 'Outro'];

/** Relato de quem testa: vai direto para o time (com tela e aparelho, sem e-mail). */
export default function FeedbackScreen() {
  const toast = useToast();
  const [kind, setKind] = useState<(typeof KINDS)[number]['key']>('bug');
  const [where, setWhere] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);

  function send() {
    reportProblem('feedback', `[${kind}${where ? ` · ${where}` : ''}] ${text.trim()}`);
    setSent(true);
    toast('Valeu! Recebemos seu relato.', 'success');
    setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 900);
  }

  return (
    <Screen bleed edges={['bottom']}>
      <Stack.Screen options={{ title: 'Reportar problema' }} />
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text tone="secondary">O FOMO está em testes. Conta o que aconteceu — vai direto para quem está construindo o app.</Text>
        <View style={styles.kinds}>
          {KINDS.map(({ key, label }) => (
            <Chip key={key} label={label} selected={kind === key} onPress={() => setKind(key)} />
          ))}
        </View>
        <Text variant="mono" tone="muted">onde</Text>
        <View style={styles.kinds}>
          {WHERE.map((w) => <Chip key={w} label={w} selected={where === w} onPress={() => setWhere(where === w ? null : w)} />)}
        </View>
        <Field label={kind === 'bug' ? 'o que você tentou e o que apareceu' : 'conta pra gente'} value={text} onChangeText={setText}
          max={1500} multiline placeholder={kind === 'bug' ? 'Ex.: toquei em Publicar com 2 fotos e ficou carregando' : ''} />
        <View style={styles.note}>
          <Text variant="caption" tone="muted">Junto vai só: a tela em que você estava, o tipo de aparelho e a versão do app. Nada de e-mail ou localização.</Text>
        </View>
        <Button label={sent ? 'Enviado' : 'Enviar'} disabled={text.trim().length < 5 || sent} onPress={send} fullWidth />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
