import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
};

/** Empty state e error state compartilham o mesmo layout. */
export function StateView({ icon, title, description, actionLabel, onAction, tone = 'neutral' }: Props) {
  return (
    <View style={styles.root} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      {icon ? <View style={[styles.icon, tone === 'error' && styles.iconError]}>{icon}</View> : null}
      <Text variant="headline" align="center">
        {title}
      </Text>
      {description ? (
        <Text tone="secondary" align="center" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant={tone === 'error' ? 'secondary' : 'primary'} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconError: { borderColor: colors.danger },
  description: { maxWidth: 320 },
  action: { marginTop: spacing.lg },
});
