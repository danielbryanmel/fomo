import { StyleSheet, View } from 'react-native';
import { LiveDot } from '@/components/ui/LiveDot';
import { Text } from '@/components/ui/Text';
import { CROWD_LABEL, LIVE_RULES } from '@/config/live';
import { formatRelative } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';
import type { LiveStatus } from '@/types/domain';
import { HeatMeter } from './HeatMeter';

/** Cartão "AGORA" — o dado mais importante do lugar, em tamanho de manchete. */
export function LiveStatusCard({ status }: { status: LiveStatus }) {
  const level = status.crowd;
  return (
    <View style={[styles.card, level ? { borderColor: `${colors.heat[level]}55` } : null]}>
      <View style={styles.top}>
        <Text variant="mono" tone="muted">agora</Text>
        <View style={styles.liveRow}>
          <LiveDot />
          <Text variant="mono" tone="live">
            ao vivo{status.lastReportAt ? ` · há ${formatRelative(status.lastReportAt)}` : ''}
          </Text>
        </View>
      </View>
      {level ? (
        <>
          <Text variant="hero" style={{ color: colors.heat[level] }} accessibilityRole="header">
            {CROWD_LABEL[level]}
          </Text>
          <HeatMeter level={level} height={8} />
          <Text variant="mono" tone="muted">
            {status.reportsCount} relatos de quem está lá · últimos {LIVE_RULES.reportTtlMin} min
          </Text>
        </>
      ) : (
        <>
          <Text variant="display" tone="secondary">Sem relatos suficientes</Text>
          <HeatMeter level={null} height={8} />
          <Text variant="caption" tone="muted">
            {status.reportsCount > 0
              ? `${status.reportsCount} ${status.reportsCount === 1 ? 'relato' : 'relatos'} recente(s). Mostramos a lotação a partir de ${LIVE_RULES.minReportsToShow}.`
              : 'Está lá? Seja a primeira pessoa a contar como está.'}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(20,18,24,0.85)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
