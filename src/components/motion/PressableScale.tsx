import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { motion } from '@/theme';

const APressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Escala no toque (padrão 0.96). */
  scaleTo?: number;
};

/**
 * Pressable com resposta física: encolhe levemente no toque e volta com mola.
 * Com "reduzir movimento", troca a escala por uma leve queda de opacidade.
 */
export function PressableScale({ children, style, scaleTo = 0.96, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);

  const anim = useAnimatedStyle(() =>
    reduce ? { opacity: 1 - p.value * 0.2 } : { transform: [{ scale: 1 - p.value * (1 - scaleTo) }] },
  );

  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        p.value = withTiming(1, { duration: motion.fast });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        p.value = withSpring(0, motion.spring.snappy);
        onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </APressable>
  );
}
