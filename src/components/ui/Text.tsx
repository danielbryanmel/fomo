import { Children, isValidElement, type ReactNode } from 'react';
import { Platform, Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts, typography, type TypographyVariant } from '@/theme';

type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'live';

const toneColor: Record<Tone, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  accent: colors.accentPink,
  danger: colors.danger,
  live: colors.live,
};

/** Cada peso da Archivo é uma família própria (estática): converte fontWeight → família. */
const WEIGHT_FAMILY: Record<string, string> = {
  '100': fonts.regular, '200': fonts.regular, '300': fonts.regular, '400': fonts.regular, normal: fonts.regular,
  '500': fonts.semibold, '600': fonts.semibold,
  '700': fonts.bold, bold: fonts.bold,
  '800': fonts.extrabold,
  '900': fonts.black,
};
export function familyFor(weight?: TextStyle['fontWeight'] | string) {
  const fam = WEIGHT_FAMILY[String(weight ?? '400')] ?? fonts.regular;
  return Platform.OS === 'web' ? `${fam}, Archivo, system-ui, sans-serif` : fam;
}

/** "quem vê" → "Quem vê" (rótulos que antes eram CAIXA ALTA agora são frase normal). */
function sentence(children: ReactNode): ReactNode {
  let done = false;
  return Children.map(children, (c) => {
    if (done) return c;
    if (typeof c === 'string' && c.trim()) {
      done = true;
      const i = c.search(/\S/);
      return c.slice(0, i) + c.charAt(i).toUpperCase() + c.slice(i + 1);
    }
    if (isValidElement(c) || typeof c === 'number') done = true;
    return c;
  });
}

export type FomoTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
};

export function Text({ variant = 'body', tone = 'primary', align, style, children, ...rest }: FomoTextProps) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  // peso pedido no estilo (ex.: fontWeight: '800') vira a família certa da Archivo
  const wide = variant === 'brand' || variant === 'hero' || variant === 'display' || variant === 'title' || variant === 'headline';
  const weightFix = flat?.fontWeight && !(wide && Number(flat.fontWeight) >= 800) ? { fontFamily: familyFor(flat.fontWeight), fontWeight: undefined } : null;
  return (
    <RNText
      maxFontSizeMultiplier={variant === 'hero' || variant === 'display' || variant === 'brand' ? 1.25 : 1.6}
      style={[typography[variant] as TextStyle, { color: toneColor[tone], textAlign: align }, style, weightFix]}
      {...rest}
    >
      {variant === 'mono' ? sentence(children) : children}
    </RNText>
  );
}
