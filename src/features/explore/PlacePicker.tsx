import { Check, LocateFixed, MapPin } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import type { LocationStatus } from '@/features/location/useLocation';
import { colors, hitTarget, radius, spacing } from '@/theme';
import type { Neighborhood } from '@/types/domain';

type Props = {
  visible: boolean;
  neighborhoods: Neighborhood[];
  current: Neighborhood | null;
  locationStatus: LocationStatus;
  onUseLocation: () => void;
  onPick: (n: Neighborhood) => void;
  onClose: () => void;
};

/** Escolha de região: localização (opcional) ou bairro manual (sempre disponível). */
export function PlacePicker({ visible, neighborhoods, current, locationStatus, onUseLocation, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const locDisabled = locationStatus === 'denied' || locationStatus === 'unavailable';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="title">Onde você quer ver?</Text>

          <Pressable
            onPress={locDisabled ? undefined : onUseLocation}
            accessibilityRole="button"
            accessibilityState={{ disabled: locDisabled }}
            style={({ pressed }) => [styles.row, styles.locRow, pressed && { backgroundColor: colors.pressed }]}
          >
            <LocateFixed size={20} color={locDisabled ? colors.textMuted : colors.accentPink} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" tone={locDisabled ? 'muted' : 'primary'}>Perto de mim</Text>
              <Text variant="caption" tone="muted">
                {locationStatus === 'denied'
                  ? 'Permissão negada. Dá para ativar nos ajustes do aparelho.'
                  : locationStatus === 'unavailable'
                    ? 'Localização indisponível neste dispositivo.'
                    : 'Uma leitura agora. Não rastreamos em segundo plano.'}
              </Text>
            </View>
            {!current && locationStatus === 'granted' ? <Check size={18} color={colors.text} /> : null}
          </Pressable>

          <Text variant="mono" tone="muted" style={styles.section}>bairros</Text>
          {neighborhoods.map((n) => (
            <Pressable key={n.id} onPress={() => onPick(n)} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressed }]}>
              <MapPin size={18} color={colors.textSecondary} />
              <Text style={styles.flex}>{n.name}</Text>
              {current?.id === n.id ? <Check size={18} color={colors.text} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 560, width: '100%', alignSelf: 'center', maxHeight: '80%',
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: spacing.sm },
  content: { padding: spacing.xl, gap: spacing.xs },
  row: { minHeight: hitTarget + 4, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md },
  locRow: { backgroundColor: colors.surfaceRaised, marginTop: spacing.md, paddingVertical: spacing.md },
  section: { marginTop: spacing.lg, marginBottom: spacing.xs, paddingHorizontal: spacing.md },
  flex: { flex: 1 },
});
