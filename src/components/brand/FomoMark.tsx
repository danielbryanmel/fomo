import Svg, { Path } from 'react-native-svg';
import { brand } from '@/theme';
import { FOMO_CRESCENT } from './paths';

/** Mantido por compatibilidade (ícones usam): o símbolo novo em viewBox -100..100. */
export const FOMO_MARK_PATH = FOMO_CRESCENT;

/** 'gradient'/'glass' são legados: o redesign não usa degradê — viram branco. */
export type FomoMarkVariant = 'white' | 'black' | 'magenta' | 'gradient' | 'glass';

export function FomoMark({ size = 40, variant = 'white', accessibilityLabel = 'FOMO' }: { size?: number; variant?: FomoMarkVariant; accessibilityLabel?: string }) {
  const fill = variant === 'black' ? brand.black : variant === 'magenta' ? brand.magenta : brand.white;
  return (
    <Svg width={size} height={size} viewBox="-100 -100 200 200" accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Path d={FOMO_CRESCENT} fill={fill} />
    </Svg>
  );
}
