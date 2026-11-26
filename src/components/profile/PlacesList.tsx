import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { CoverArt } from '@/components/event/CoverArt';
import { RatingStars } from '@/components/post/RatingStars';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme';
import type { PostView } from '@/types/domain';

type Place = { key: string; name: string; sub: string | null; eventId: string | null; posts: PostView[]; last: string; rating: number | null };

/** Aba "Rolês" do perfil (redesign): lugares por onde a pessoa passou, agrupados, sem card por linha. */
export function PlacesList({ posts }: { posts: PostView[] }) {
  const map = new Map<string, Place>();
  for (const p of posts) {
    const name = p.event?.venueName ?? p.placeName ?? p.event?.title;
    if (!name) continue;
    const key = name.toLowerCase();
    const when = p.experienceDate ?? p.createdAt;
    const cur = map.get(key);
    if (cur) {
      cur.posts.push(p);
      if (when > cur.last) cur.last = when;
      if (p.rating) cur.rating = cur.rating ? Math.max(cur.rating, p.rating) : p.rating;
    } else {
      map.set(key, { key, name, sub: p.event?.title && p.event.title !== name ? p.event.title : null, eventId: p.eventId, posts: [p], last: when, rating: p.rating });
    }
  }
  const places = [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
  return (
    <View>
      {places.map((pl) => {
        const photo = pl.posts.find((p) => p.photos.length)?.photos[0]?.source;
        const n = pl.posts.length;
        const last = new Date(pl.last).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
        return (
          <Pressable
            key={pl.key}
            onPress={pl.eventId ? () => router.push({ pathname: '/event/[id]', params: { id: pl.eventId! } }) : undefined}
            disabled={!pl.eventId}
            accessibilityRole={pl.eventId ? 'link' : undefined}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.thumb}>
              {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" /> : <CoverArt seed={pl.key} rounded={12} style={styles.thumb} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline" numberOfLines={1}>{pl.name}</Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {[pl.sub, n === 1 ? '1 vez' : `${n} vezes`, `última em ${last}`].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {pl.rating ? <RatingStars value={pl.rating} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.surfaceRaised },
  thumb: { width: 52, height: 52, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
});
