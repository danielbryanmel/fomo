import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme';

type Props = {
  /** Intensidade 0–1. Padrão discreto. */
  intensity?: number;
  /** Posição dos brilhos. */
  variant?: 'top' | 'center' | 'split';
};

/**
 * Brilhos difusos magenta/roxo atrás do conteúdo — assinatura visual da marca.
 * Usar só em telas-chave (Explorar, lugar, relato, perfil). Puramente decorativo.
 */
export function Ambient({ intensity = 0.55, variant = 'top' }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const spots =
    variant === 'center'
      ? [
          { cx: 35, cy: 40, r: 55, c: colors.accentPink },
          { cx: 75, cy: 65, r: 50, c: colors.accentPurple },
        ]
      : variant === 'split'
        ? [
            { cx: 90, cy: 8, r: 50, c: colors.accentPink },
            { cx: 5, cy: 85, r: 45, c: colors.accentPurple },
          ]
        : [
            { cx: 80, cy: 0, r: 60, c: colors.accentPink },
            { cx: 10, cy: 22, r: 45, c: colors.accentPurple },
          ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          {spots.map((s, i) => (
            <RadialGradient key={i} id={`a${id}${i}`} cx={s.cx} cy={s.cy} r={s.r} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={s.c} stopOpacity={0.42 * intensity} />
              <Stop offset="0.55" stopColor={s.c} stopOpacity={0.12 * intensity} />
              <Stop offset="1" stopColor={s.c} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {spots.map((_, i) => (
          <Rect key={i} width="100" height="100" fill={`url(#a${id}${i})`} />
        ))}
      </Svg>
    </View>
  );
}
