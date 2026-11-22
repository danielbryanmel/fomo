import { useEffect, useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, radius } from '@/theme';

type Props = { value: number; height?: number; accessibilityLabel?: string };

/** Barra de progresso (ex.: XP até o próximo nível). value ∈ [0,1]. Enche ao aparecer. */
export function ProgressBar({ value, height = 6, accessibilityLabel }: Props) {
  const gid = `pg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
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
      <Animated.View style={[{ height, overflow: 'hidden' }, fill]}>
        <Svg width={Math.max(w, 1)} height={height}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.brandGradient[0]} />
              <Stop offset="1" stopColor={colors.brandGradient[2]} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gid})`} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
});
