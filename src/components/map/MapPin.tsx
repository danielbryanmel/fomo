import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';
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
  const color = level ? colors.heat[level] : now ? colors.text : colors.textSecondary;
  const size = selected ? 18 : level ? 12 + level : 11;
  const halo = level ? size + 8 + level * 3 : 0;

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
              borderColor: now ? (selected ? colors.text : 'rgba(0,0,0,0.5)') : color,
              borderWidth: now ? (selected ? 2.5 : 1.5) : 2.5,
            },
          ]}
        />
      </View>
      {selected || (level ?? 0) >= 3 ? (
        <View style={[styles.label, selected && styles.labelSelected]}>
          <Text variant="label" numberOfLines={1} style={{ fontSize: 11 }}>{event.venueName ?? event.title}</Text>
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
    maxWidth: 140,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(10,10,12,0.82)',
  },
  labelSelected: { borderWidth: 1, borderColor: colors.borderStrong },
});
