import { router } from 'expo-router';
import { CalendarDays, Camera, ChevronRight, Image as ImageIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FOMO_CRESCENT } from '@/components/brand/paths';
import { Screen, Text, useToast } from '@/components/ui';
import { LIVE_RULES } from '@/config/live';
import { lastKnownPoint } from '@/features/location/useLocation';
import { distanceM, regionToBounds } from '@/lib/geo';
import { repositories } from '@/repositories';
import { colors, radius, spacing, TAB_BAR_SPACE } from '@/theme';

/**
 * Menu do "+" (redesign): "Contar como tá agora" primeiro; depois fotos do rolê, story e evento futuro.
 * Contar exige escolher o rolê no mapa (o relato é sempre de um lugar específico).
 */
export default function PublishScreen() {
  const toast = useToast();
  return (
    <Screen scroll contentStyle={styles.content}>
      <Text variant="display" accessibilityRole="header" style={styles.title}>O que você quer compartilhar?</Text>

      <Row
        big
        icon={<Svg width={30} height={30} viewBox="-100 -100 200 200"><Path d={FOMO_CRESCENT} fill={colors.background} /></Svg>}
        iconBg={colors.live}
        title="Contar como tá agora"
        body="Lotação, vibe e fila de onde você tá. Leva 3 toques."
        onPress={async () => {
          // atalho: se a última posição conhecida está a até 200 m de um rolê rolando agora, abre o relato direto.
          // (a tela de relato confere a localização de novo, na hora — o atalho não vale como prova de presença)
          const here = await lastKnownPoint();
          if (here) {
            try {
              const d = 0.01;
              const list = await repositories.events.listForMap({
                bounds: regionToBounds({ latitude: here.latitude, longitude: here.longitude, latitudeDelta: d, longitudeDelta: d }),
                origin: here,
              });
              const near = list
                .filter((e) => e.happeningNow)
                .map((e) => ({ e, m: distanceM(here, { latitude: e.latitude, longitude: e.longitude }) }))
                .filter((x) => x.m <= LIVE_RULES.maxDistanceM)
                .sort((a, b) => a.m - b.m)[0];
              if (near) return router.push({ pathname: '/report/[id]', params: { id: near.e.id } });
            } catch {
              /* sem rede: cai no fluxo pelo mapa */
            }
          }
          router.navigate('/');
          toast('Toca no rolê onde você tá e depois em "Contar como tá".');
        }}
      />
      <Row
        big
        icon={<ImageIcon size={28} color={colors.background} strokeWidth={2.2} />}
        iconBg={colors.accent}
        title="Postar fotos do rolê"
        body="Até 10 fotos, legenda, lugar e nota. Vai pro feed e pro seu perfil."
        onPress={() => router.push('/compose')}
      />
      <Row icon={<Camera size={22} color={colors.text} />} title="Story de 24 h" body="Câmera dupla: o rolê e sua selfie numa foto só." onPress={() => router.push('/story/new')} />
      <Row icon={<CalendarDays size={22} color={colors.text} />} title="Divulgar um evento futuro" body="Passa pela moderação antes de aparecer no mapa." onPress={() => router.push('/suggest')} />
    </Screen>
  );
}

function Row({ icon, iconBg, title, body, onPress, big }: { icon: ReactNode; iconBg?: string; title: string; body: string; onPress?: () => void; big?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, big && styles.rowBig, pressed && { opacity: 0.85 }]}>
      <View style={[styles.icon, big && styles.iconBig, { backgroundColor: iconBg ?? colors.surfaceRaised }]}>{icon}</View>
      <View style={styles.flex}>
        <Text variant="headline" style={big ? { fontSize: 19, lineHeight: 24 } : undefined}>{title}</Text>
        <Text tone="secondary">{body}</Text>
      </View>
      <ChevronRight size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: TAB_BAR_SPACE + spacing.xl },
  title: { fontSize: 30, lineHeight: 34, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface },
  rowBig: { paddingVertical: spacing.lg + 2 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconBig: { width: 52, height: 52, borderRadius: 16 },
  flex: { flex: 1, gap: 2 },
});
