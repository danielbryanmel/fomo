import { StyleSheet, View } from 'react-native';
import { LiveDot } from '@/components/ui/LiveDot';
import { Text } from '@/components/ui/Text';
import { CROWD_LABEL, LIVE_RULES } from '@/config/live';
import { formatRelative } from '@/lib/format';
import Svg, { Path } from 'react-native-svg';
import { FOMO_CRESCENT } from '@/components/brand/paths';
import { colors, heatScale, radius, spacing } from '@/theme';
import type { LiveStatus } from '@/types/domain';
import { HeatMeter } from './HeatMeter';

/** Cartão "AGORA" — o dado mais importante do lugar, em tamanho de manchete. */
export function LiveStatusCard({ status }: { status: LiveStatus }) {
  const level = status.crowd;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text variant="body" tone="secondary">Agora</Text>
        <View style={styles.liveRow}>
          <LiveDot />
          <Text variant="caption" tone="live" style={{ fontWeight: '700' }}>
            Ao vivo{status.lastReportAt ? ` · há ${formatRelative(status.lastReportAt)}` : ''}
          </Text>
        </View>
      </View>
      {level ? (
        <>
          <View style={styles.big}>
            <Text variant="hero" style={{ color: heatScale[level].dot, fontSize: 48, lineHeight: 54, flex: 1 }} accessibilityRole="header">
              {CROWD_LABEL[level]}
            </Text>
            <Svg width={40} height={40} viewBox="-100 -100 200 200"><Path d={FOMO_CRESCENT} fill={heatScale[level].dot} /></Svg>
          </View>
          <HeatMeter level={level} height={8} />
          <Text variant="caption" tone="secondary">
            {status.reportsCount} relatos nos últimos {LIVE_RULES.reportTtlMin} min
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
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  big: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
