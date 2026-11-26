import Svg, { G, Path } from 'react-native-svg';
import { brand } from '@/theme';
import { FOMO_CRESCENT, FOMO_LETTERS } from './paths';

/** Símbolo + wordmark oficiais (manual de marca). `size` = altura das letras. */
export function FomoLockup({ size = 22, color = brand.white }: { size?: number; color?: string }) {
  const h = size;
  const w = (h * 4728) / 726;
  return (
    <Svg width={w} height={h} viewBox="-10 -20 4728 726" accessibilityRole="image" accessibilityLabel="FOMO">
      <G fill={color}>
        <G transform="translate(343 343) scale(3.43)"><Path d={FOMO_CRESCENT} /></G>
        <G transform="translate(812 0)">{FOMO_LETTERS.map((d) => <Path key={d.slice(0, 12)} d={d} />)}</G>
      </G>
    </Svg>
  );
}
