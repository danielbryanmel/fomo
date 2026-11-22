import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { LEVELS } from '@/config/levels';
import { colors, radius, spacing } from '@/theme';

/** Nível compacto para cards ("Nv 5"). Versão completa no ProfileHeader. */
export function LevelBadge({ level, showName }: { level: number; showName?: boolean }) {
  const name = LEVELS.find((l) => l.level === level)?.name ?? '';
  return (
    <View style={styles.badge} accessibilityLabel={`Nível ${level}, ${name}`}>
      <Text variant="label" style={{ color: colors.signal.experience }}>
        Nv {level}{showName ? ` · ${name}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(138,54,232,0.14)',
  },
});
