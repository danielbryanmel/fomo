import { StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useId } from 'react';
import { radius } from '@/theme';

/** Paletas por categoria — tons escuros, acentos discretos (sem neon). */
const PALETTES: Record<string, [string, string, string]> = {
  festas: ['#2B0F2A', '#5A1747', '#E8368C'],
  bares: ['#1B1410', '#4A2A1A', '#E0905A'],
  shows: ['#120F2B', '#2E1A5C', '#8A36E8'],
  geek: ['#0D1D24', '#16404A', '#3CC6C0'],
  cultura: ['#1E1A0F', '#4A3F1A', '#E2C25A'],
};

type Props = { uri?: string | null; seed: string; category?: string; style?: ViewStyle; rounded?: number };

/**
 * Capa de evento. Usa a foto real quando houver; senão, arte abstrata determinística
 * (mock sem imagens externas — nenhuma foto inventada de lugar real).
 */
export function CoverArt({ uri, seed, category = 'festas', style, rounded = radius.lg }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (uri) {
    return <Image source={{ uri }} style={[styles.fill, { borderRadius: rounded }, style as ImageStyle]} contentFit="cover" transition={200} />;
  }
  const [bg1, bg2, accent] = PALETTES[category] ?? PALETTES.festas!;
  const h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);
  const cx = 20 + (h % 60);
  const cy = 25 + ((h * 7) % 50);
  return (
    <View style={[styles.fill, { borderRadius: rounded, overflow: 'hidden' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={bg1} />
            <Stop offset="1" stopColor={bg2} />
          </LinearGradient>
          <RadialGradient id={`gl${id}`} cx={cx} cy={cy} r="38" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={accent} stopOpacity={0.55} />
            <Stop offset="1" stopColor={accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100" height="60" fill={`url(#bg${id})`} />
        <Rect width="100" height="60" fill={`url(#gl${id})`} />
        <Circle cx={100 - cx / 2} cy={60 - cy / 3} r={6 + (h % 8)} fill={accent} opacity={0.18} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { width: '100%', aspectRatio: 16 / 9 } });
