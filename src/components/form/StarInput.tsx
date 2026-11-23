import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { StarGlyph, formatRating } from '@/components/post/RatingStars';
import { Text } from '@/components/ui/Text';
import { colors, motion } from '@/theme';

const LABELS: Record<number, string> = {
  0.5: 'Péssimo', 1: 'Fraco', 1.5: 'Fraco', 2: 'Ok', 2.5: 'Ok', 3: 'Bom', 3.5: 'Bom', 4: 'Muito bom', 4.5: 'Muito bom', 5: 'Inesquecível',
};

const SIZE = 36;

function StarButton({ i, value, onChange }: { i: number; value: number; onChange: (n: number) => void }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const fill = value >= i ? 1 : value >= i - 0.5 ? 0.5 : 0;
  useEffect(() => {
    if (fill > 0 && !reduce) s.value = withDelay((i - 1) * 40, withSequence(withTiming(1.22, { duration: 90 }), withSpring(1, motion.spring.bouncy)));
  }, [value, fill, i, reduce, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const pick = (n: number) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
    onChange(n === value ? 0 : n); // tocar de novo na mesma nota limpa
  };
  return (
    <View style={styles.hit}>
      <Animated.View style={st} pointerEvents="none">
        <StarGlyph size={SIZE} fill={fill} />
      </Animated.View>
      {/* metade esquerda = meia estrela; direita = estrela cheia */}
      <Pressable style={[styles.half, { left: 0 }]} onPress={() => pick(i - 0.5)} accessibilityRole="radio"
        accessibilityState={{ checked: value === i - 0.5 }} accessibilityLabel={`${formatRating(i - 0.5)} de 5`} />
      <Pressable style={[styles.half, { right: 0 }]} onPress={() => pick(i)} accessibilityRole="radio"
        accessibilityState={{ checked: value === i }} accessibilityLabel={`${i} de 5`} />
    </View>
  );
}

/** Nota de 0,5 a 5: toque na metade esquerda da estrela para meia, na direita para inteira. */
export function StarInput({ value, onChange, showLabel = true }: { value: number; onChange: (n: number) => void; showLabel?: boolean }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Nota">
        {[1, 2, 3, 4, 5].map((i) => <StarButton key={i} i={i} value={value} onChange={onChange} />)}
      </View>
      {showLabel && value > 0 ? (
        <Text variant="mono" tone="secondary" align="center">{formatRating(value)} · {LABELS[value] ?? ''}</Text>
      ) : null}
    </View>
  );
}

export const ratingLabel = (n: number) => LABELS[n] ?? '';

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  hit: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  half: { position: 'absolute', top: 0, bottom: 0, width: '50%' },
});
