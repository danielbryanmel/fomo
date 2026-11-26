import { StyleSheet } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

type Props = { label: string; selected?: boolean; onPress?: () => void };

/** Filtro/categoria. Selecionado = fundo branco, texto preto (GUIA). */
export function Chip({ label, selected, onPress }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      hitSlop={8}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text variant="label" style={{ color: selected ? colors.onSelected : '#D9D4DE', fontWeight: selected ? '700' : '600', fontSize: 14 }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.selected },
});
