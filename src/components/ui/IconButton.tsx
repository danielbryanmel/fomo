import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { colors, hitTarget, motion, radius } from '@/theme';

const APressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  variant?: 'plain' | 'filled';
  selected?: boolean;
  /** "Estoura" o ícone quando passa a selecionado (curtir, salvar, seguir). */
  pop?: boolean;
};

export function IconButton({ icon, label, onPress, variant = 'plain', selected, pop }: Props) {
  const reduce = useReducedMotion();
  const press = useSharedValue(0);
  const burst = useSharedValue(1);
  const was = useRef(selected);

  useEffect(() => {
    if (pop && selected && !was.current && !reduce) {
      burst.value = withSequence(withTiming(1.3, { duration: 110 }), withSpring(1, motion.spring.bouncy));
    }
    was.current = selected;
  }, [selected, pop, reduce, burst]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: (reduce ? 1 : 1 - press.value * 0.12) * burst.value }],
    backgroundColor: press.value > 0.01 ? colors.pressed : 'transparent',
  }));

  return (
    <APressable
      onPress={onPress}
      onPressIn={() => (press.value = withTiming(1, { duration: motion.fast }))}
      onPressOut={() => (press.value = withSpring(0, motion.spring.snappy))}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={4}
      style={[styles.base, anim, variant === 'filled' && styles.filled]}
    >
      {icon}
    </APressable>
  );
}

const styles = StyleSheet.create({
  base: { minWidth: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  filled: { backgroundColor: colors.overlay, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, minWidth: 40, height: 40 },
});
