import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, hitTarget, radius, spacing } from '@/theme';
import { Text } from './Text';

export type SheetAction = {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  actions: SheetAction[];
  onClose: () => void;
};

/**
 * Menu/confirmação própria do app (funciona igual em iOS, Android e Web,
 * sem depender de window.confirm). Na Fase 3 pode migrar para @gorhom/bottom-sheet.
 */
export function ActionSheet({ visible, title, message, actions, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar menu" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
        {title ? <Text variant="headline" align="center">{title}</Text> : null}
        {message ? <Text tone="secondary" align="center" style={styles.message}>{message}</Text> : null}
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.pressed }]}
            >
              {a.icon}
              <Text variant="bodyStrong" tone={a.destructive ? 'danger' : 'primary'}>{a.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.action, styles.cancel, pressed && { backgroundColor: colors.pressed }]}>
            <Text variant="bodyStrong" tone="secondary">Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  message: { marginTop: spacing.xs },
  actions: { marginTop: spacing.md, gap: spacing.xs },
  action: {
    minHeight: hitTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  cancel: { justifyContent: 'center', backgroundColor: 'transparent' },
});
