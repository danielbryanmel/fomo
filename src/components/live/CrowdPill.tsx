import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { CROWD_LABEL } from '@/config/live';
import { colors, radius, spacing } from '@/theme';
import type { CrowdLevel } from '@/types/domain';

/** Etiqueta de lotação ("LOTADO"). Nível 4 ganha preenchimento; os demais, contorno. */
export function CrowdPill({ level }: { level: CrowdLevel | null }) {
  if (!level) {
    return (
      <View style={[styles.pill, { borderColor: colors.borderStrong }]}>
        <Text variant="mono" tone="muted">sem relatos</Text>
      </View>
    );
  }
  const c = colors.heat[level];
  const filled = level >= 3;
  return (
    <View style={[styles.pill, { borderColor: c, backgroundColor: filled ? c : 'transparent' }]}>
      <Text variant="mono" style={{ color: filled ? colors.text : c, fontWeight: '700' }}>{CROWD_LABEL[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start' },
});
