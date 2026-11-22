import { useEffect, useState } from 'react';
import { type DimensionValue, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius } from '@/theme';

type Props = { width?: DimensionValue; height?: number; rounded?: number };

/**
 * Placeholder com brilho que atravessa da esquerda para a direita.
 * Com "reduzir movimento" fica estático (sem pulso).
 */
export function Skeleton({ width = '100%', height = 16, rounded = radius.sm }: Props) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(t);
  }, [reduce, t]);

  const sheen = useAnimatedStyle(() => ({
    transform: [{ translateX: -w * 0.6 + t.value * w * 1.6 }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width, height, borderRadius: rounded }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {reduce || !w ? null : <Animated.View style={[StyleSheet.absoluteFill, styles.sheen, sheen]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  sheen: { width: '60%', backgroundColor: 'rgba(255,255,255,0.05)' },
});
