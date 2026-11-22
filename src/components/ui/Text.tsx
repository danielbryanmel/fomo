import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, typography, type TypographyVariant } from '@/theme';

type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'live';

const toneColor: Record<Tone, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  accent: colors.accentPink,
  danger: colors.danger,
  live: colors.live,
};

export type FomoTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
};

export function Text({ variant = 'body', tone = 'primary', align, style, ...rest }: FomoTextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={variant === 'hero' || variant === 'display' ? 1.25 : 1.6}
      style={[typography[variant] as TextStyle, { color: toneColor[tone], textAlign: align }, style]}
      {...rest}
    />
  );
}
