import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { colors, heatScale } from '@/theme';

type Level = 0 | 1 | 2 | 3 | 4;

/** Ícone-termômetro (4 barras). Acende até `level` na cor fixa do nível. Anima "th" (scaleY escalonado .15s). */
export function ThermoBars({ level, size = 20, onColor, animate = true }: { level: Level; size?: number; onColor?: string; animate?: boolean }) {
  const reduce = useReducedMotion();
  const bw = size * 0.2;
  const gap = size * 0.07;
  const c = onColor ?? (level ? heatScale[level as 1 | 2 | 3 | 4].dot : colors.heat.none);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap, height: size }} accessibilityElementsHidden>
      {[1, 2, 3, 4].map((i) => (
        <Bar key={i} h={size * (0.4 + 0.2 * (i - 1))} w={bw} color={i <= level ? c : colors.surfaceRaised} delay={(i - 1) * 150} animate={animate && !reduce} />
      ))}
    </View>
  );
}

function Bar({ h, w, color, delay, animate }: { h: number; w: number; color: string; delay: number; animate: boolean }) {
  const s = useSharedValue(animate ? 0.06 : 1);
  useEffect(() => {
    if (animate) s.value = withDelay(delay, withTiming(1, { duration: 700, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [animate, delay, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: (h * (1 - s.value)) / 2 }, { scaleY: s.value }] }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: w / 3, backgroundColor: color }, st]} />;
}
