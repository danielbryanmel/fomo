import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'safe' | 'outline' | 'light';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
};

/** Botão base (GUIA): primário magenta sólido com texto preto, 54px, pílula. Sem gradiente. */
export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, fullWidth, accessibilityHint }: Props) {
  const isDisabled = disabled || loading;
  const dark = (variant === 'primary' || variant === 'safe' || variant === 'light') && !disabled;
  const fg = disabled ? colors.textMuted : dark ? colors.textOnAccent : variant === 'danger' ? colors.danger : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      scaleTo={0.97}
      style={[styles.base, variantStyle[variant], fullWidth && styles.full, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {isValidElement(icon) && (icon.props as { color?: string }).color !== undefined ? cloneElement(icon as ReactElement<{ color?: string }>, { color: fg }) : icon}
          <Text variant="bodyStrong" style={{ color: fg, fontWeight: '800' }}>{label}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 54, paddingHorizontal: spacing.xl, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  full: { alignSelf: 'stretch' },
  disabled: { backgroundColor: colors.surfaceRaised, borderColor: colors.surfaceRaised },
});

const variantStyle = StyleSheet.create({
  primary: { backgroundColor: colors.accent },
  safe: { backgroundColor: colors.live },
  light: { backgroundColor: colors.selected },
  secondary: { backgroundColor: colors.surfaceRaised },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
});
