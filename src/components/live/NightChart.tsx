import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { CROWD_LABEL } from '@/config/live';
import { colors, radius, spacing } from '@/theme';
import type { CrowdLevel, LiveStatus } from '@/types/domain';

const MIN_SLOTS = 5;
const MAX_SLOTS = 8;

type Slot = { hour: string; crowd: CrowdLevel | null; now: boolean };

/**
 * Preenche a linha do tempo: do primeiro relato até agora, uma coluna por hora.
 * Horas sem relato aparecem como "traço" (sem inventar dado).
 */
function buildSlots(timeline: LiveStatus['timeline']): Slot[] {
  const byHour = new Map(timeline.map((t) => [parseInt(t.hour, 10), t.crowd as CrowdLevel | null]));
  const nowH = new Date().getHours();
  const firstH = timeline.length ? parseInt(timeline[0]!.hour, 10) : nowH;
  let span = (nowH - firstH + 24) % 24;
  span = Math.min(Math.max(span + 1, MIN_SLOTS), MAX_SLOTS);
  return Array.from({ length: span }, (_, i) => {
    const h = (nowH - (span - 1 - i) + 24) % 24;
    return { hour: `${String(h).padStart(2, '0')}h`, crowd: byHour.get(h) ?? null, now: i === span - 1 };
  });
}

function Bar({ slot, i, reduce }: { slot: Slot; i: number; reduce: boolean }) {
  const target = slot.crowd ? slot.crowd / 4 : 0.06;
  const h = useSharedValue(reduce ? target : 0);
  useEffect(() => {
    h.value = reduce ? target : withDelay(80 + i * 60, withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [target, i, reduce, h]);
  const st = useAnimatedStyle(() => ({ height: `${h.value * 100}%` }));
  const color = slot.crowd ? colors.heat[slot.crowd] : colors.heat.none;
  return (
    <View style={styles.col}>
      <View style={styles.barArea}>
        <Animated.View style={[styles.bar, { backgroundColor: color, opacity: slot.now ? 1 : slot.crowd ? 0.7 : 0.5 }, slot.now && styles.barNow, st]} />
      </View>
      <Text variant="mono" tone={slot.now ? 'primary' : 'muted'} style={{ fontSize: 10 }}>{slot.now ? 'agora' : slot.hour}</Text>
    </View>
  );
}

/** "Como tá a noite": lotação por hora até agora. Altura = nível (1–4). */
export function NightChart({ timeline }: { timeline: LiveStatus['timeline'] }) {
  const reduce = useReducedMotion();
  if (!timeline.length) return null;
  const slots = buildSlots(timeline);
  const summary = slots.map((t) => `${t.hour}: ${t.crowd ? CROWD_LABEL[t.crowd] : 'sem relatos'}`).join(', ');
  const peak = timeline.reduce<number>((m, t) => Math.max(m, t.crowd ?? 0), 0) as CrowdLevel | 0;
  return (
    <View style={styles.card} accessible accessibilityLabel={`Lotação ao longo da noite. ${summary}`}>
      <View style={styles.head}>
        <Text variant="mono" tone="muted">como tá a noite</Text>
        {peak ? <Text variant="mono" tone="secondary">pico · {CROWD_LABEL[peak].toLowerCase()}</Text> : null}
      </View>
      <View style={styles.bars}>
        {slots.map((s, i) => <Bar key={s.hour} slot={s} i={i} reduce={reduce} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bars: { flexDirection: 'row', gap: spacing.sm, height: 110, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', gap: spacing.xs, height: '100%' },
  barArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: radius.sm, minHeight: 4 },
  barNow: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
});
