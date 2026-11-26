import { router } from 'expo-router';
import { CalendarClock, Check, ExternalLink, MapPin, ShieldCheck, X } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeOutLeft, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { Appear } from '@/components/motion';
import { Button, Screen, Skeleton, StateView, Text, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { openExternal } from '@/lib/external';
import { formatEventDate, formatPrice } from '@/lib/format';
import { repositories } from '@/repositories';
import { colors, motion, radius, spacing } from '@/theme';
import type { EventView } from '@/types/domain';

const exit = FadeOutLeft.duration(motion.base).reduceMotion(ReduceMotion.System);
const layout = LinearTransition.springify().damping(motion.spring.soft.damping).reduceMotion(ReduceMotion.System);

/** Fila de moderação de rolês sugeridos. A permissão é checada no servidor (moderate_event). */
export default function ModerationScreen() {
  const toast = useToast();
  const list = useAsync(() => repositories.events.listPending(), []);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(e: EventView, approve: boolean) {
    setBusy(e.id);
    try {
      await repositories.events.moderate(e.id, approve);
      list.setData((l) => l?.filter((x) => x.id !== e.id));
      toast(approve ? 'Aprovado · já está no mapa' : 'Recusado', approve ? 'success' : 'neutral');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível moderar.', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen bleed edges={['bottom']}>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.accentPink} />}
        ListHeaderComponent={
          <Text tone="secondary" style={styles.intro}>
            Confira se o rolê é real, aberto ao público e se o pin está no lugar certo. Na dúvida, recuse.
          </Text>
        }
        renderItem={({ item: e, index }) => (
          <Animated.View exiting={exit} layout={layout}>
            <Appear index={index} style={styles.card}>
              <Text variant="mono" tone="secondary">{e.category.name} · {formatPrice(e.priceMinCents, e.priceMaxCents)}</Text>
              <Text variant="title">{e.title}</Text>
              <View style={styles.line}><CalendarClock size={14} color={colors.textMuted} /><Text tone="secondary">{formatEventDate(e.startsAt)}</Text></View>
              <View style={styles.line}><MapPin size={14} color={colors.textMuted} /><Text tone="secondary" style={styles.flex}>{[e.venueName, e.address].filter(Boolean).join(' · ') || 'sem endereço'}</Text></View>
              <Text variant="mono" tone="muted">pin {e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}</Text>
              {e.description ? <Text tone="secondary" numberOfLines={4}>{e.description}</Text> : null}
              <View style={styles.row}>
                <Button label="Ver página" variant="ghost" onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} />
                {e.ticketUrl ? <Button label="Link" variant="ghost" icon={<ExternalLink size={16} color={colors.text} />} onPress={() => openExternal(e.ticketUrl!)} /> : null}
              </View>
              <View style={styles.row}>
                <View style={styles.flex}><Button label="Recusar" variant="danger" icon={<X size={16} color={colors.danger} />} fullWidth disabled={busy === e.id} onPress={() => decide(e, false)} /></View>
                <View style={styles.flex}><Button label="Aprovar" icon={<Check size={16} color={colors.text} />} fullWidth loading={busy === e.id} onPress={() => decide(e, true)} /></View>
              </View>
            </Appear>
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          list.loading ? (
            <View style={{ gap: spacing.md }}><Skeleton height={220} rounded={radius.lg} /><Skeleton height={220} rounded={radius.lg} /></View>
          ) : list.error ? (
            <StateView tone="error" title="Não foi possível carregar" actionLabel="Tentar de novo" onAction={list.refresh} />
          ) : (
            <StateView icon={<ShieldCheck size={26} color={colors.live} />} title="Fila vazia" description="Nenhuma sugestão esperando revisão." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, flexGrow: 1 },
  intro: { marginBottom: spacing.lg },
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
});
