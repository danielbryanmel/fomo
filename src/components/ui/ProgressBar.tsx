import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { colors, radius } from '@/theme';

type Props = { value: number; height?: number; accessibilityLabel?: string; color?: string };

/** Barra de progresso (ex.: XP até o próximo nível). value ∈ [0,1]. Enche ao aparecer. Cor sólida. */
export function ProgressBar({ value, height = 6, accessibilityLabel, color = colors.accent }: Props) {
  const v = Math.min(1, Math.max(0, value));
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const p = useSharedValue(reduce ? v : 0);
  useEffect(() => {
    p.value = reduce ? v : withDelay(120, withTiming(v, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [v, reduce, p]);
  const fill = useAnimatedStyle(() => ({ width: w * p.value }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={[styles.track, { height }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[{ height, backgroundColor: color, borderRadius: radius.pill }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
});
