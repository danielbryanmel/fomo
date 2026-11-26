import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, spacing } from '@/theme';
import { Text } from './Text';

/** Abas de texto alinhadas à esquerda (GUIA): ativa em branco com sublinhado de 2px que "desenha" (gl). */
export function TextTabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={styles.root} accessibilityRole="tablist">
      {tabs.map((t) => (
        <Tab key={t.key} label={t.label} active={t.key === value} onPress={() => onChange(t.key)} />
      ))}
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    s.value = reduce ? (active ? 1 : 0) : withTiming(active ? 1 : 0, { duration: active ? 450 : 150, easing: Easing.bezier(0.75, 0, 0.2, 1) });
  }, [active, reduce, s]);
  const line = useAnimatedStyle(() => ({ transform: [{ scaleX: s.value }] }));
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.tab} hitSlop={6}>
      <Text variant="bodyStrong" style={{ fontSize: 16, fontWeight: '800', color: active ? colors.text : colors.textMuted }}>{label}</Text>
      <Animated.View style={[styles.line, line]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', gap: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.surfaceRaised },
  tab: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  line: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, backgroundColor: colors.text },
});
