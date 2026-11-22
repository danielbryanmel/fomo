import { StyleSheet } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

type Props = { label: string; selected?: boolean; onPress?: () => void };

/** Filtro/categoria. Selecionado = borda acento, sem gradiente (evita excesso de neon). */
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
      <Text variant="label" tone={selected ? 'primary' : 'secondary'}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
});
