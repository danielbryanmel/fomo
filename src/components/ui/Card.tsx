import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/theme';

type Props = { children: ReactNode; style?: ViewStyle; raised?: boolean };

export function Card({ children, style, raised }: Props) {
  return (
    <View style={[styles.card, raised && { backgroundColor: colors.surfaceRaised }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
