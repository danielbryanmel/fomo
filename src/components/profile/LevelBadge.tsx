import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { LEVELS } from '@/config/levels';
import { colors, radius, spacing } from '@/theme';

/** Nível compacto para cards ("Nv 5"). Versão completa no ProfileHeader. */
export function LevelBadge({ level, showName }: { level: number; showName?: boolean }) {
  const name = LEVELS.find((l) => l.level === level)?.name ?? '';
  return (
    <View style={styles.badge} accessibilityLabel={`Nível ${level}, ${name}`}>
      <Text variant="label" style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
        Nv {level}{showName ? ` · ${name}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
});
