import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

type Props<K extends string | number> = {
  label: string;
  options: { key: K; label: string }[];
  value: K | null;
  onChange: (k: K) => void;
  optional?: boolean;
  /** Cor do item escolhido (ex.: cor do nível de lotação). */
  activeColor?: (k: K) => string;
};

/** Grade de 4 opções de toque único (relato em 3 toques). */
export function OptionGrid<K extends string | number>({ label, options, value, onChange, optional, activeColor }: Props<K>) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text variant="mono" tone="muted">{label}{optional ? ' · opcional' : ''}</Text>
      <View style={styles.row}>
        {options.map((o) => {
          const active = o.key === value;
          const c = active ? (activeColor?.(o.key) ?? colors.text) : undefined;
          return (
            <Pressable
              key={String(o.key)}
              onPress={() => {
                if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
                onChange(o.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={({ pressed }) => [styles.opt, active && { backgroundColor: c, borderColor: c }, pressed && !active && { backgroundColor: colors.pressed }]}
            >
              <Text variant="bodyStrong" numberOfLines={1} style={{ fontSize: 14, letterSpacing: -0.2, color: active ? (c === colors.text ? colors.background : colors.text) : colors.textSecondary }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  opt: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
});
