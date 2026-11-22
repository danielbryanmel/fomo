import { createContext, useContext, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FomoLockup } from '@/components/brand/FomoLockup';
import { Ambient } from '@/components/ui/Ambient';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

const FRAME_W = 440;

const FrameSize = createContext<{ width: number; height: number } | null>(null);

/** Tamanho útil do app: a janela no celular, a moldura no computador. */
export function useAppSize() {
  const win = useWindowDimensions();
  return useContext(FrameSize) ?? { width: win.width, height: win.height };
}
const BREAKPOINT = 720;

/**
 * No celular (e no app nativo) não faz nada. Em tela larga (computador/tablet deitado),
 * centraliza o app numa coluna com proporção de celular — o FOMO é mobile-first e
 * esticar o layout a 1400 px pioraria a experiência.
 */
export function WebFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < BREAKPOINT) return <>{children}</>;
  const h = Math.min(height - spacing.xl * 2, 920);
  return (
    <View style={styles.page}>
      <Ambient variant="split" intensity={0.8} />
      <View style={styles.side}>
        <FomoLockup size={30} />
        <Text variant="display" style={styles.sideTitle}>De olho no rolê.</Text>
        <Text tone="secondary" style={styles.sideText}>
          O FOMO foi feito para o celular. Abra este link no seu telefone e use “Adicionar à tela inicial” para ter o app.
        </Text>
        <Text variant="mono" tone="muted">versão de testes</Text>
      </View>
      <View style={[styles.frame, { height: h }]}>
        <FrameSize.Provider value={{ width: FRAME_W, height: h }}>{children}</FrameSize.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 64, backgroundColor: colors.background, padding: spacing.xl },
  side: { maxWidth: 340, gap: spacing.lg },
  sideTitle: { marginTop: spacing.md },
  sideText: { lineHeight: 22 },
  frame: {
    width: FRAME_W,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.background,
  },
});
