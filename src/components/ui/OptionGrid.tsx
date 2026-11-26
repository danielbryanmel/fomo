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
  /** Texto sobre a cor ativa (padrão: preto sobre branco). */
  activeText?: (k: K) => string;
  /** Bolinha de cor acima do rótulo (ex.: termômetro). */
  dot?: (k: K) => string;
};

/** Grade de 4 opções de toque único (relato em 3 toques). Selecionado = branco; lotação = cor do termômetro. */
export function OptionGrid<K extends string | number>({ label, options, value, onChange, optional, activeColor, activeText, dot }: Props<K>) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <View style={styles.head}>
        <Text variant="section">{label.charAt(0).toUpperCase() + label.slice(1)}</Text>
        {optional ? <Text variant="caption" tone="muted">opcional</Text> : null}
      </View>
      <View style={styles.row}>
        {options.map((o) => {
          const active = o.key === value;
          const c = active ? (activeColor?.(o.key) ?? colors.selected) : undefined;
          const fg = active ? (activeText?.(o.key) ?? colors.onSelected) : colors.text;
          return (
            <Pressable
              key={String(o.key)}
              onPress={() => {
                if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
                onChange(o.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={({ pressed }) => [styles.opt, active && { backgroundColor: c }, pressed && !active && { opacity: 0.8 }]}
            >
              {dot ? <View style={[styles.dot, { backgroundColor: active ? fg : dot(o.key) }]} /> : null}
              <Text variant="bodyStrong" numberOfLines={1} style={{ fontSize: 14, fontWeight: active ? '800' : '700', color: fg }}>
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
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', gap: spacing.sm },
  opt: {
    flex: 1,
    height: 64,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
