import { type ReactNode, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Plus } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { PressableScale } from '@/components/motion/PressableScale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { colors, hitTarget, motion, spacing } from '@/theme';

const PUBLISH_ROUTE = 'publish';

function TabIcon({ focused, children }: { focused: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    s.value = reduce ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, motion.spring.snappy);
  }, [focused, reduce, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 + s.value * 0.06 }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

/**
 * Barra inferior (redesign): fixa, encostada embaixo, fundo do app com linha no topo.
 * O "+" é um círculo magenta com ícone preto. (Nome mantido para não mexer nas rotas.)
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const fabSpin = useSharedValue(0);
  const fabIcon = useAnimatedStyle(() => ({ transform: [{ rotate: `${fabSpin.value * 90}deg` }] }));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
              if (route.name === PUBLISH_ROUTE && !reduce) fabSpin.value = withSequence(withTiming(1, { duration: 220 }), withTiming(0, { duration: 0 }));
              navigateToTab(route.key);
            }
          };

          if (route.name === PUBLISH_ROUTE) {
            return (
              <View key={route.key} style={styles.item}>
                <PressableScale
                  onPress={onPress}
                  scaleTo={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? 'Publicar'}
                  style={styles.fab}
                >
                  <Animated.View style={fabIcon}>
                    <Plus size={26} color={colors.textOnAccent} strokeWidth={2.6} />
                  </Animated.View>
                </PressableScale>
              </View>
            );
          }

          const color = focused ? colors.text : colors.textMuted;
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.item}
            >
              <TabIcon focused={focused}>{options.tabBarIcon?.({ focused, color, size: 24 })}</TabIcon>
              <Text variant="label" style={{ color, fontSize: 11, lineHeight: 14, fontWeight: '700' }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.surfaceRaised },
  row: { flexDirection: 'row', alignItems: 'center', height: 64, width: '100%', maxWidth: 560, alignSelf: 'center' },
  item: { flex: 1, height: '100%', minWidth: hitTarget, alignItems: 'center', justifyContent: 'center', gap: 3 },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
