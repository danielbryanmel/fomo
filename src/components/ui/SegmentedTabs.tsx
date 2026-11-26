import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { colors, hitTarget, motion, spacing } from '@/theme';
import { Text } from './Text';

type Props<K extends string> = {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
};

/** Abas com sublinhado que desliza até a aba ativa (perfil, salvos, feed). */
export function SegmentedTabs<K extends string>({ tabs, value, onChange }: Props<K>) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, tabs.findIndex((t) => t.key === value));
  const tabW = tabs.length ? w / tabs.length : 0;
  const x = useDerivedValue(() => withSpring(idx * tabW, motion.spring.soft), [idx, tabW]);
  const bar = useAnimatedStyle(() => ({ transform: [{ translateX: x.value + tabW * 0.1 }], width: tabW * 0.8 }));

  return (
    <View style={styles.root} accessibilityRole="tablist" onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(t.key)}
            style={styles.tab}
          >
            <Text variant="bodyStrong" tone={active ? 'primary' : 'muted'}>{t.label}</Text>
          </Pressable>
        );
      })}
      {w ? <Animated.View pointerEvents="none" style={[styles.indicator, bar]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, minHeight: hitTarget, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.sm, paddingBottom: spacing.sm },
  indicator: { position: 'absolute', left: 0, bottom: 0, height: 2, borderRadius: 1, backgroundColor: colors.text },
});
