import { router } from 'expo-router';
import { Aperture, CalendarPlus, Camera, ChevronRight, ImagePlus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ambient, Screen, Text } from '@/components/ui';
import { colors, radius, spacing, TAB_BAR_SPACE } from '@/theme';

/**
 * Publicar — dois caminhos bem separados (requisito 3):
 *  - Rolê vivido (fotos/experiência que já aconteceu) → /compose
 *  - Evento futuro (cadastro com moderação) → Fase 6
 */
export default function PublishScreen() {
  return (
    <Screen scroll contentStyle={styles.content}>
      <Ambient variant="top" intensity={0.6} />
      <Text variant="mono" tone="muted">publicar</Text>
      <Text variant="display">O que você quer compartilhar?</Text>

      <Pressable onPress={() => router.push('/compose')} style={({ pressed }) => [styles.hero, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel="Postar fotos de um rolê">
        <View style={styles.heroIcon}><ImagePlus size={30} color={colors.text} /></View>
        <View style={styles.flex}>
          <Text variant="title">Postar fotos do rolê</Text>
          <Text tone="secondary">Até 10 fotos, legenda, lugar e nota. Vai para o feed e para o seu perfil.</Text>
        </View>
        <ChevronRight size={22} color={colors.textSecondary} />
      </Pressable>

      <Row icon={<Aperture size={22} color={colors.accentPink} />} title="Story de 24 h" body="Câmera dupla: o rolê e sua selfie numa foto só." onPress={() => router.push('/story/new')} />
      <Row icon={<Camera size={22} color={colors.text} />} title="Tirar foto agora" body="Abre a câmera e já cria a publicação." onPress={() => router.push({ pathname: '/compose', params: { source: 'camera' } })} />
      <Row icon={<CalendarPlus size={22} color={colors.accentPurple} />} title="Divulgar um evento futuro" body="Passa por moderação antes de aparecer no mapa." onPress={() => router.push('/suggest')} />
    </Screen>
  );
}

function Row({ icon, title, body, onPress, disabled }: { icon: ReactNode; title: string; body: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={({ pressed }) => [styles.row, disabled && { opacity: 0.5 }, pressed && { backgroundColor: colors.pressed }]}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">{body}</Text>
      </View>
      {!disabled ? <ChevronRight size={20} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.xl, paddingBottom: TAB_BAR_SPACE + spacing.xl },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl, marginTop: spacing.sm,
    borderRadius: radius.xl, backgroundColor: 'rgba(28,24,34,0.92)', borderWidth: 1, borderColor: 'rgba(232,54,140,0.45)',
  },
  heroIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPink },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rowIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  flex: { flex: 1, gap: 2 },
});
