import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { colors, motion, radius, spacing } from '@/theme';

type Props = { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; icon?: ReactNode };

/** Linha com interruptor próprio (mesmo visual em iOS, Android e Web). */
export function ToggleRow({ label, description, value, onChange, icon }: Props) {
  const v = useDerivedValue(() => withSpring(value ? 1 : 0, motion.spring.snappy), [value]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(v.value, [0, 1], [colors.surfaceRaised, colors.accentPink]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: v.value * 20 }] }));
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={description}
      style={styles.row}
    >
      {icon}
      <View style={styles.text}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? <Text variant="caption" tone="secondary">{description}</Text> : null}
      </View>
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  text: { flex: 1, gap: 2 },
  track: { width: 48, height: 28, borderRadius: 14, padding: 3, borderWidth: 1, borderColor: colors.border },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text },
});
