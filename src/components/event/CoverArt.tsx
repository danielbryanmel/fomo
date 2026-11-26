import { StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { FOMO_CRESCENT } from '@/components/brand/paths';
import { colors, radius } from '@/theme';

type Props = { uri?: string | null; seed: string; category?: string; style?: ViewStyle; rounded?: number };

/**
 * Capa de evento. Usa a foto real quando houver; sem foto, um bloco liso com o símbolo
 * (o redesign proíbe degradê/bolinhas como imagem e não inventamos foto de lugar).
 */
export function CoverArt({ uri, style, rounded = radius.lg }: Props) {
  if (uri) {
    return <Image source={{ uri }} style={[styles.fill, { borderRadius: rounded }, style as ImageStyle]} contentFit="cover" transition={200} />;
  }
  return (
    <View style={[styles.fill, styles.empty, { borderRadius: rounded }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="22%" height="40%" viewBox="-100 -100 200 200"><Path d={FOMO_CRESCENT} fill={colors.borderStrong} /></Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', aspectRatio: 16 / 9 },
  empty: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
