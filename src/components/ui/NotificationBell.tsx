import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useUnread } from '@/features/notifications/useUnread';
import { colors, motion } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

/** Sino com contador. Balança quando chega notificação nova. */
export function NotificationBell() {
  const count = useUnread();
  const reduce = useReducedMotion();
  const prev = useRef(count);
  const r = useSharedValue(0);

  useEffect(() => {
    if (count > prev.current && !reduce) {
      r.value = withSequence(withTiming(1, { duration: 80 }), withTiming(-1, { duration: 120 }), withTiming(0.6, { duration: 100 }), withSpring(0, motion.spring.bouncy));
    }
    prev.current = count;
  }, [count, reduce, r]);

  const swing = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 14}deg` }] }));
  const label = count ? `Notificações, ${count} não lidas` : 'Notificações';

  return (
    <View>
      <IconButton
        label={label}
        variant="filled"
        onPress={() => router.push('/notifications')}
        icon={<Animated.View style={swing}><Bell size={20} color={colors.text} /></Animated.View>}
      />
      {count ? (
        <View style={styles.badge} pointerEvents="none">
          <Text variant="mono" style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPink, borderWidth: 2, borderColor: colors.background,
  },
  badgeText: { fontSize: 10, lineHeight: 12, letterSpacing: 0, color: colors.text, fontWeight: '700' },
});
