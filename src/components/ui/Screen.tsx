import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  /** Sem padding horizontal — para mapa/listas full-bleed. */
  bleed?: boolean;
};

/** Container base: fundo da marca + safe areas. As tabs já cuidam da borda inferior. */
export function Screen({ children, scroll, edges = ['top'], contentStyle, bleed }: Props) {
  const padding = bleed ? undefined : styles.padded;
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, styles.grow, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, padding, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  grow: { flexGrow: 1 },
  // flex: 1 + minHeight 0: ocupa só a tela, e as listas de dentro rolam (flexGrow sozinho crescia do tamanho do conteúdo e travava a rolagem)
  fill: { flex: 1, minHeight: 0 },
  padded: { paddingHorizontal: spacing.lg },
});
