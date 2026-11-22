import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Copy } from 'lucide-react-native';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme';
import type { PostView } from '@/types/domain';

/** Grade 3 colunas (perfil), como em apps de fotos. Post só de texto vira um bloco de texto. */
export function PostGrid({ posts }: { posts: PostView[] }) {
  const [w, setW] = useState(0);
  const gap = 2;
  const size = w ? (w - gap * 2) / 3 : 0;
  return (
    <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {size > 0 &&
        posts.map((p) => {
          const cover = p.photos[0];
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } })}
              accessibilityRole="link"
              accessibilityLabel={cover ? `Publicação com ${p.photos.length} foto(s)` : `Publicação: ${p.body?.slice(0, 60) ?? ''}`}
              style={({ pressed }) => [{ width: size, height: size * 1.25 }, styles.cell, pressed && { opacity: 0.8 }]}
            >
              {cover ? (
                <>
                  <Image source={cover.source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                  {p.photos.length > 1 ? <View style={styles.multi}><Copy size={14} color={colors.text} /></View> : null}
                </>
              ) : (
                <View style={styles.textCell}>
                  <Text variant="caption" numberOfLines={6}>{p.body}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginHorizontal: -spacing.lg },
  cell: { backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  multi: { position: 'absolute', top: 6, right: 6 },
  textCell: { flex: 1, padding: spacing.sm, justifyContent: 'center', backgroundColor: colors.surface },
});
