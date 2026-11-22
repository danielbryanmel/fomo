import { type ReactNode, useEffect, useId, useState } from 'react';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Plus } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { PressableScale } from '@/components/motion/PressableScale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { colors, hitTarget, motion, radius, spacing } from '@/theme';

const PUBLISH_ROUTE = 'publish';

type Layout = { x: number; width: number };

/** Ícone do item: sobe um pouco e "respira" quando vira ativo. */
function TabIcon({ focused, children }: { focused: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    s.value = reduce ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, motion.spring.snappy);
  }, [focused, reduce, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -s.value * 1.5 }, { scale: 1 + s.value * 0.08 }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

/**
 * Tab bar flutuante (pílula com blur) + botão central de publicar.
 * 5 destinos mantidos (requisito), com o + em destaque como no conceito.
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const gid = `fab${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, Layout>>({});
  const active = state.routes[state.index];
  const target = active ? layouts[active.key] : undefined;
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const pillO = useSharedValue(0);
  const fabSpin = useSharedValue(0);

  useEffect(() => {
    if (!target || active?.name === PUBLISH_ROUTE) {
      pillO.value = withTiming(0, { duration: motion.fast });
      return;
    }
    const first = pillW.value === 0;
    pillX.value = reduce || first ? target.x : withSpring(target.x, motion.spring.soft);
    pillW.value = reduce || first ? target.width : withSpring(target.width, motion.spring.soft);
    pillO.value = withTiming(1, { duration: motion.base });
  }, [target?.x, target?.width, active?.name, reduce, pillX, pillW, pillO, target]);

  const pill = useAnimatedStyle(() => ({ opacity: pillO.value, width: pillW.value, transform: [{ translateX: pillX.value }] }));
  const fabIcon = useAnimatedStyle(() => ({ transform: [{ rotate: `${fabSpin.value * 90}deg` }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar}>
        {Platform.OS === 'ios' ? (
          <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.barBg]} />
        <Animated.View pointerEvents="none" style={[styles.pill, pill]} />
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
              <PressableScale
                key={route.key}
                onPress={onPress}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={options.tabBarAccessibilityLabel ?? 'Publicar'}
                style={styles.fab}
              >
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Svg width="100%" height="100%">
                    <Defs>
                      <LinearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
                        <Stop offset="0" stopColor={colors.brandGradient[0]} />
                        <Stop offset="1" stopColor={colors.brandGradient[2]} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill={`url(#${gid})`} />
                  </Svg>
                </View>
                <Animated.View style={[styles.fabIcon, fabIcon]}>
                  <Plus size={24} color={colors.text} strokeWidth={2.5} />
                </Animated.View>
              </PressableScale>
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
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setLayouts((l) => (l[route.key]?.x === x && l[route.key]?.width === width ? l : { ...l, [route.key]: { x, width } }));
              }}
            >
              <TabIcon focused={focused}>{options.tabBarIcon?.({ focused, color, size: 22 })}</TabIcon>
              <Text variant="label" style={{ color, fontSize: 10, lineHeight: 13 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: spacing.lg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    height: 64,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.xs,
  },
  barBg: { backgroundColor: Platform.OS === 'ios' ? 'rgba(15,14,18,0.55)' : 'rgba(15,14,18,0.94)' },
  item: { flex: 1, height: '100%', minWidth: hitTarget, alignItems: 'center', justifyContent: 'center', gap: 2 },
  fabIcon: { zIndex: 1 },
  pill: { position: 'absolute', left: 0, top: 8, bottom: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.07)' },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
