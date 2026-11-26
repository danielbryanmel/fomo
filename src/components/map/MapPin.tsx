import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { CROWD_LABEL } from '@/config/live';
import { colors, heatScale, spacing } from '@/theme';
import type { MapEvent } from '@/types/domain';

type Props = { event: MapEvent; selected?: boolean };

/**
 * Pin do mapa.
 *  - acontecendo agora com lotação: ponto cheio na cor do calor + halo proporcional ao nível;
 *  - acontecendo sem relatos suficientes: ponto branco;
 *  - futuro: anel vazado (não compete com o que está rolando agora).
 * Selecionado: mostra o nome ao lado.
 */
export function MapPin({ event, selected }: Props) {
  const level = event.live?.crowd ?? null;
  const now = event.happeningNow;
  const color = level ? heatScale[level].dot : now ? colors.text : colors.textMuted;
  const size = selected ? 18 : 14;
  const halo = level === 4 ? size + 12 : 0;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.dotBox, { width: Math.max(halo, size), height: Math.max(halo, size) }]}>
        {level ? <View style={[styles.halo, { width: halo, height: halo, borderRadius: halo, backgroundColor: color }]} /> : null}
        <View
          style={[
            styles.dot,
            {
              width: size,
              height: size,
              borderRadius: size,
              backgroundColor: now ? color : colors.background,
              borderColor: now ? colors.text : color,
              borderWidth: now ? (selected ? 2.5 : 0) : 2.5,
            },
          ]}
        />
      </View>
      {selected || level || (!event.isDemo && !now) ? (
        <View style={[styles.label, selected && styles.labelSelected]}>
          <Text variant="label" numberOfLines={1} style={{ fontSize: 13, fontWeight: '700' }}>
            {event.venueName ?? event.title}
            {level ? <Text style={{ fontSize: 13, fontWeight: '800', color: level === 1 ? colors.textSecondary : heatScale[level].dot }}>{`  ${CROWD_LABEL[level]}`}</Text> : null}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dotBox: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', opacity: 0.25 },
  dot: {},
  label: {
    maxWidth: 220,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(21,20,23,0.92)',
  },
  labelSelected: { borderWidth: 1, borderColor: colors.borderStrong },
});
