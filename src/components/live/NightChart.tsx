import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { CROWD_LABEL } from '@/config/live';
import { colors, radius, spacing } from '@/theme';
import type { LiveStatus } from '@/types/domain';

/** "Como tá a noite": lotação por hora. Altura = nível (1–4), rótulo da hora embaixo. */
export function NightChart({ timeline }: { timeline: LiveStatus['timeline'] }) {
  if (!timeline.length) return null;
  const summary = timeline.map((t) => `${t.hour}: ${t.crowd ? CROWD_LABEL[t.crowd] : 'sem dados'}`).join(', ');
  return (
    <View style={styles.card} accessible accessibilityLabel={`Lotação ao longo da noite. ${summary}`}>
      <Text variant="mono" tone="muted">como tá a noite</Text>
      <View style={styles.bars}>
        {timeline.map((t, i) => {
          const last = i === timeline.length - 1;
          return (
            <View key={t.hour} style={styles.col}>
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${((t.crowd ?? 0.4) / 4) * 100}%`,
                      backgroundColor: t.crowd ? colors.heat[t.crowd] : colors.heat.none,
                      opacity: last ? 1 : 0.75,
                    },
                  ]}
                />
              </View>
              <Text variant="mono" tone={last ? 'primary' : 'muted'} style={{ fontSize: 10 }}>{last ? 'agora' : t.hour}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bars: { flexDirection: 'row', gap: spacing.sm, height: 110, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', gap: spacing.xs, height: '100%' },
  barArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: radius.sm },
});
