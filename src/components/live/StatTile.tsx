import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

/** Bloco de fato rápido: rótulo mono, valor grande, detalhe. */
export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}>
      <Text variant="mono" tone="muted">{label}</Text>
      <Text variant="headline" numberOfLines={1}>{value}</Text>
      {detail ? <Text variant="mono" tone="muted" numberOfLines={1} style={{ fontSize: 10 }}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 140, gap: 4, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface },
});
