import { useId } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, hitTarget, radius, spacing } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

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

/** Botão base. Apenas `primary` usa o gradiente da marca. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  fullWidth,
  accessibilityHint,
}: Props) {
  const isDisabled = disabled || loading;
  const gid = `btn${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      scaleTo={0.97}
      style={[styles.base, variantStyle[variant], fullWidth && styles.full, isDisabled && styles.disabled]}
    >
      {variant === 'primary' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.brandGradient[0]} />
                <Stop offset="0.55" stopColor={colors.brandGradient[1]} />
                <Stop offset="1" stopColor={colors.brandGradient[2]} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gid})`} />
          </Svg>
        </View>
      )}
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="bodyStrong" tone={variant === 'danger' ? 'danger' : 'primary'}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hitTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  full: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
});

const variantStyle = StyleSheet.create({
  primary: {},
  secondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
});
