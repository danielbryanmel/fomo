import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { colors, motion } from '@/theme';

const LABELS = ['', 'Fraco', 'Ok', 'Bom', 'Muito bom', 'Inesquecível'];

function StarButton({ i, value, onPress }: { i: number; value: number; onPress: () => void }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const on = i <= value;
  useEffect(() => {
    if (on && !reduce) s.value = withDelay((i - 1) * 40, withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, motion.spring.bouncy)));
  }, [value, on, i, reduce, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="radio" accessibilityState={{ checked: i === value }} accessibilityLabel={`${i} de 5 — ${LABELS[i]}`} style={styles.hit}>
      <Animated.View style={st}>
        <Star size={36} color={on ? colors.warning : colors.border} fill={on ? colors.warning : 'transparent'} />
      </Animated.View>
    </Pressable>
  );
}

/** Nota 1–5 com estrelas grandes que acendem em sequência. */
export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Nota">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarButton key={i} i={i} value={value} onPress={() => {
          if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
          onChange(i);
        }} />
      ))}
    </View>
  );
}

export const ratingLabel = (n: number) => LABELS[n] ?? '';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  hit: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
});
