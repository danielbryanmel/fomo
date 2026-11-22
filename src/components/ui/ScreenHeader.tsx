import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@/theme';
import { Text } from './Text';

type Props = { title: string; subtitle?: string; leading?: ReactNode; trailing?: ReactNode };

export function ScreenHeader({ title, subtitle, leading, trailing }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.left}>
        {leading}
        <View>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text tone="secondary" variant="caption">{subtitle}</Text> : null}
        </View>
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
