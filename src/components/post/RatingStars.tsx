import { Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

/** Estrela com preenchimento parcial (0, 0.5 ou 1). */
export function StarGlyph({ fill, size, empty = colors.border }: { fill: number; size: number; empty?: string }) {
  return (
    <View style={{ width: size, height: size }}>
      <Star size={size} color={fill > 0 ? colors.warning : empty} fill="transparent" />
      {fill > 0 ? (
        <View style={[StyleSheet.absoluteFill, { width: size * fill, overflow: 'hidden' }]}>
          <Star size={size} color={colors.warning} fill={colors.warning} />
        </View>
      ) : null}
    </View>
  );
}

export const formatRating = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

export function RatingStars({ value, size = 14 }: { value: number; size?: number }) {
  const v = Number(value);
  return (
    <View style={styles.row} accessibilityLabel={`Avaliação ${formatRating(v)} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarGlyph key={i} size={size} fill={v >= i ? 1 : v >= i - 0.5 ? 0.5 : 0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 2 } });
