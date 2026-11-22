import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { CROWD_LABEL } from '@/config/live';
import { colors, motion, radius, spacing } from '@/theme';
import type { CrowdLevel } from '@/types/domain';

type Props = { level: CrowdLevel | null; height?: number; gap?: number };

function Segment({ on, color, height, i, reduce }: { on: boolean; color: string; height: number; i: number; reduce: boolean }) {
  const v = useSharedValue(reduce ? (on ? 1 : 0) : 0);
  useEffect(() => {
    v.value = reduce ? (on ? 1 : 0) : withDelay(i * 70, withSpring(on ? 1 : 0, motion.spring.soft));
  }, [on, i, reduce, v]);
  const s = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [colors.heat.none, color]),
    opacity: 0.55 + v.value * 0.45,
  }));
  return <Animated.View style={[styles.seg, { height }, s]} />;
}

/**
 * Medidor de lotação em 4 segmentos que "acende" em sequência.
 * A informação está na QUANTIDADE de segmentos (e no rótulo), não só na cor.
 */
export function HeatMeter({ level, height = 5, gap = spacing.xs + 2 }: Props) {
  const reduce = useReducedMotion();
  const color = level ? colors.heat[level] : colors.heat.none;
  return (
    <View
      style={[styles.row, { gap }]}
      accessibilityRole="progressbar"
      accessibilityLabel={level ? `Lotação: ${CROWD_LABEL[level]}, ${level} de 4` : 'Sem relatos recentes'}
      accessibilityValue={{ min: 0, max: 4, now: level ?? 0 }}
    >
      {[1, 2, 3, 4].map((i) => (
        <Segment key={i} i={i} on={!!level && i <= level} color={color} height={height} reduce={reduce} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  seg: { flex: 1, borderRadius: radius.pill },
});
