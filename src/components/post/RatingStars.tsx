import { Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

export function RatingStars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`Avaliação ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          color={i <= value ? colors.warning : colors.border}
          fill={i <= value ? colors.warning : 'transparent'}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 2 } });
