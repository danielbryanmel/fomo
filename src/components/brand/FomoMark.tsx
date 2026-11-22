import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { brand } from '@/theme';

/**
 * Símbolo oficial FOMO — "O olhar que escapa" (Identidade V4, prancha 04).
 *
 * Geometria (viewBox 0 0 100 100), medida na prancha oficial com erro < 3% (só antialias):
 *   círculo principal: centro (50,50), r = 50
 *   recorte ("pupila"): centro (70.4, 29.4), r = 27.3  → offset (+0.408R, −0.412R), raio 0.546R
 * NÃO alterar estes valores sem a fonte vetorial oficial.
 */
export const FOMO_MARK_PATH =
  'M65.658 2.515A50 50 0 1 0 97.330 33.879A27.3 27.3 0 1 1 65.658 2.515Z';

export type FomoMarkVariant = 'gradient' | 'glass' | 'white' | 'black';

type Props = {
  size?: number;
  variant?: FomoMarkVariant;
  accessibilityLabel?: string;
};

export function FomoMark({ size = 40, variant = 'gradient', accessibilityLabel = 'FOMO' }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const lin = `fomoLin${uid}`;
  const hl = `fomoHl${uid}`;

  const fill =
    variant === 'white' ? brand.white : variant === 'black' ? brand.black : `url(#${lin})`;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {variant === 'gradient' || variant === 'glass' ? (
        <Defs>
          {/* diagonal: rosa/magenta (inferior esquerdo) → roxo (superior direito) */}
          {variant === 'glass' ? (
            <LinearGradient id={lin} x1="0.1" y1="0.9" x2="0.9" y2="0.1">
              <Stop offset="0" stopColor={brand.pinkVivid} />
              <Stop offset="0.3" stopColor="#D6359C" />
              <Stop offset="0.58" stopColor="#A938D6" />
              <Stop offset="1" stopColor={brand.purple} />
            </LinearGradient>
          ) : (
            <LinearGradient id={lin} x1="0.1" y1="0.9" x2="0.9" y2="0.1">
              <Stop offset="0" stopColor={brand.pink} />
              <Stop offset="0.5" stopColor={brand.magenta} />
              <Stop offset="1" stopColor="#A43BD8" />
            </LinearGradient>
          )}
          <RadialGradient id={hl} cx="30" cy="72" r="46" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={brand.highlight} stopOpacity={1} />
            <Stop offset="0.3" stopColor="#F29ACB" stopOpacity={0.8} />
            <Stop offset="0.65" stopColor={brand.pinkVivid} stopOpacity={0.3} />
            <Stop offset="1" stopColor={brand.pinkVivid} stopOpacity={0} />
          </RadialGradient>
        </Defs>
      ) : null}
      <Path d={FOMO_MARK_PATH} fill={fill} />
      {variant === 'glass' ? <Path d={FOMO_MARK_PATH} fill={`url(#${hl})`} /> : null}
    </Svg>
  );
}
