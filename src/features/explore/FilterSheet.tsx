import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';
import type { DateFilter, PriceFilter } from '@/types/domain';

export type ExploreFilters = { date: DateFilter; maxDistanceKm: number | null; price: PriceFilter };
export const DEFAULT_FILTERS: ExploreFilters = { date: 'today', maxDistanceKm: null, price: 'any' };

export function activeFilterCount(f: ExploreFilters) {
  return (f.date !== DEFAULT_FILTERS.date ? 1 : 0) + (f.maxDistanceKm ? 1 : 0) + (f.price !== 'any' ? 1 : 0);
}

const DATES: { key: DateFilter; label: string }[] = [
  { key: 'now', label: 'Agora' },
  { key: 'today', label: 'Hoje' },
  { key: 'weekend', label: 'Fim de semana' },
  { key: 'any', label: 'Qualquer dia' },
];
const DISTANCES: { key: number | null; label: string }[] = [
  { key: 1, label: 'Até 1 km' },
  { key: 3, label: 'Até 3 km' },
  { key: 10, label: 'Até 10 km' },
  { key: null, label: 'Qualquer' },
];
const PRICES: { key: PriceFilter; label: string }[] = [
  { key: 'any', label: 'Qualquer' },
  { key: 'free', label: 'Grátis' },
  { key: 'upTo50', label: 'Até R$ 50' },
  { key: 'over50', label: 'Acima de R$ 50' },
];

type Props = {
  visible: boolean;
  value: ExploreFilters;
  hasOrigin: boolean;
  onChange: (f: ExploreFilters) => void;
  onClose: () => void;
};

export function FilterSheet({ visible, value, hasOrigin, onChange, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar filtros" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="title">Filtros</Text>

          <Group title="Quando">
            {DATES.map((d) => (
              <Chip key={d.key} label={d.label} selected={value.date === d.key} onPress={() => onChange({ ...value, date: d.key })} />
            ))}
          </Group>

          <Group title="Distância" note={hasOrigin ? undefined : 'Escolha um bairro ou use sua localização para filtrar por distância.'}>
            {DISTANCES.map((d) => (
              <Chip
                key={String(d.key)}
                label={d.label}
                selected={value.maxDistanceKm === d.key}
                onPress={() => hasOrigin && onChange({ ...value, maxDistanceKm: d.key })}
              />
            ))}
          </Group>

          <Group title="Preço">
            {PRICES.map((p) => (
              <Chip key={p.key} label={p.label} selected={value.price === p.key} onPress={() => onChange({ ...value, price: p.key })} />
            ))}
          </Group>

          <View style={styles.actions}>
            <Button label="Limpar" variant="secondary" onPress={() => onChange(DEFAULT_FILTERS)} />
            <View style={styles.flex}>
              <Button label="Ver no mapa" fullWidth onPress={onClose} />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="mono" tone="muted">{title}</Text>
      <View style={styles.chips}>{children}</View>
      {note ? <Text variant="caption" tone="muted">{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 560, width: '100%', alignSelf: 'center',
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, maxHeight: '85%',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: spacing.sm },
  content: { padding: spacing.xl, gap: spacing.xl },
  group: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
});
