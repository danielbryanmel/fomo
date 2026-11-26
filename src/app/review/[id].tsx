import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Field } from '@/components/form/Field';
import { ratingLabel, StarInput } from '@/components/form/StarInput';
import { Appear } from '@/components/motion';
import { ShieldCheck } from 'lucide-react-native';
import { CoverArt } from '@/components/event/CoverArt';
import { Button, Chip, StateView, Text, useToast } from '@/components/ui';
import { REVIEW_ASPECTS } from '@/config/live';
import type { ReviewAspect } from '@/types/domain';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';

/** Criar/editar a minha avaliação (uma por rolê). */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const event = useAsync(() => repositories.events.getById(id), [id]);
  const mine = useAsync(() => repositories.events.myReview(id), [id]);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [aspects, setAspects] = useState<ReviewAspect[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mine.data) {
      setRating(mine.data.rating);
      setBody(mine.data.body ?? '');
      setAspects(mine.data.aspects ?? []);
    }
  }, [mine.data]);

  if (event.loading || mine.loading) return <View style={styles.center}><ActivityIndicator color={colors.accentPink} /></View>;
  if (!event.data) return <StateView title="Rolê não encontrado" actionLabel="Voltar" onAction={() => router.back()} />;

  async function save() {
    setSaving(true);
    try {
      await repositories.events.saveReview(id, rating, body || null, aspects);
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
        <Text variant="display" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 31 }}>Avaliar rolê</Text>
        <Appear style={styles.eventCard}>
          <View style={styles.thumb}><CoverArt uri={event.data.coverUrl} seed={event.data.id} category={event.data.category.slug} rounded={10} style={styles.thumb} /></View>
          <View style={{ flex: 1 }}>
            <Text variant="headline" numberOfLines={1}>{event.data.title}</Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>{event.data.venueName ?? event.data.category.name}</Text>
          </View>
        </Appear>
        <Appear index={1} style={styles.head}>
          <StarInput value={rating} onChange={setRating} />
          <Text variant="headline" tone={rating ? 'primary' : 'muted'}>{rating ? ratingLabel(rating) : 'Toque para dar a nota'}</Text>
        </Appear>
        <Appear index={2} style={{ gap: spacing.sm }}>
          <Text variant="section">O que pesou?</Text>
          <View style={styles.chips}>
            {(Object.keys(REVIEW_ASPECTS) as ReviewAspect[]).map((k) => (
              <Chip key={k} label={REVIEW_ASPECTS[k]} selected={aspects.includes(k)} onPress={() => setAspects((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))} />
            ))}
          </View>
        </Appear>
        <Appear index={3}>
          <Field label="Como foi · opcional" value={body} onChangeText={setBody} max={1000} multiline placeholder="Som, lotação, fila, preço, segurança…" />
        </Appear>
        <Appear index={4} style={styles.note}>
          <ShieldCheck size={18} color={colors.textSecondary} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>Avaliação de quem teve a presença confirmada pesa mais na sua credibilidade.</Text>
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
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  thumb: { width: 56, height: 56, aspectRatio: 1, borderRadius: 10, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.background },
});
