import { useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Text, type FomoTextProps } from '@/components/ui/Text';
import { motion } from '@/theme';

type Props = Omit<FomoTextProps, 'children'> & { value: number; format?: (n: number) => string; suffix?: string };

/**
 * Número que "pula" quando muda (curtidas, seguidores, XP). O valor em si troca
 * na hora — a animação é só de ênfase, então leitores de tela leem o certo.
 */
export function AnimatedCount({ value, format = String, suffix = '', ...text }: Props) {
  const reduce = useReducedMotion();
  const prev = useRef(value);
  const s = useSharedValue(1);

  useEffect(() => {
    if (prev.current !== value && !reduce) {
      const up = value > prev.current;
      s.value = withSequence(withTiming(up ? 1.18 : 0.88, { duration: motion.fast }), withSpring(1, motion.spring.bouncy));
    }
    prev.current = value;
  }, [value, reduce, s]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[{ alignSelf: 'flex-start' }, style]}>
      <Text {...text}>{format(value)}{suffix}</Text>
    </Animated.View>
  );
}
