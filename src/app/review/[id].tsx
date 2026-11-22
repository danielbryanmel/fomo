import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Field } from '@/components/form/Field';
import { ratingLabel, StarInput } from '@/components/form/StarInput';
import { Appear } from '@/components/motion';
import { Button, StateView, Text, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, spacing } from '@/theme';

/** Criar/editar a minha avaliação (uma por rolê). */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const event = useAsync(() => repositories.events.getById(id), [id]);
  const mine = useAsync(() => repositories.events.myReview(id), [id]);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mine.data) {
      setRating(mine.data.rating);
      setBody(mine.data.body ?? '');
    }
  }, [mine.data]);

  if (event.loading || mine.loading) return <View style={styles.center}><ActivityIndicator color={colors.accentPink} /></View>;
  if (!event.data) return <StateView title="Rolê não encontrado" actionLabel="Voltar" onAction={() => router.back()} />;

  async function save() {
    setSaving(true);
    try {
      await repositories.events.saveReview(id, rating, body || null);
      toast(mine.data ? 'Avaliação atualizada' : 'Avaliação publicada', 'success');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Appear style={styles.head}>
          <Text variant="mono" tone="muted">{event.data.venueName ?? event.data.category.name}</Text>
          <Text variant="display" align="center">{event.data.title}</Text>
        </Appear>
        <Appear index={1} style={styles.head}>
          <StarInput value={rating} onChange={setRating} />
          <Text variant="headline" tone={rating ? 'primary' : 'muted'}>{rating ? ratingLabel(rating) : 'Toque para dar a nota'}</Text>
        </Appear>
        <Appear index={2}>
          <Field label="como foi · opcional" value={body} onChangeText={setBody} max={1000} multiline placeholder="Som, lotação, fila, preço, segurança…" />
        </Appear>
        <Appear index={3}>
          <Text variant="caption" tone="muted" align="center">
            Avaliações de quem teve presença confirmada pesam mais na sua credibilidade. Seja específico e honesto.
          </Text>
        </Appear>
      </ScrollView>
      <View style={styles.bar}>
        <Button label={mine.data ? 'Atualizar avaliação' : 'Publicar avaliação'} fullWidth loading={saving} disabled={!rating} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 },
  head: { alignItems: 'center', gap: spacing.sm },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: 'rgba(10,10,12,0.94)' },
});
