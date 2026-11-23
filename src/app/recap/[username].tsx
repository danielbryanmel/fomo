import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { MoonStar, Share2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Appear, PressableScale } from '@/components/motion';
import { formatRating, RatingStars } from '@/components/post/RatingStars';
import { Avatar, Button, Chip, Screen, Skeleton, StateView, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { publicUrl, shareContent } from '@/lib/external';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { PostView } from '@/types/domain';

/** A "noite" vai até as 6h: um post das 2h de sábado conta na noite de sexta. */
function nightKey(p: PostView): string {
  if (p.experienceDate) return p.experienceDate.slice(0, 10);
  const d = new Date(new Date(p.createdAt).getTime() - 6 * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function nightLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(y!, m! - 1, d!).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1); // "Sábado, 21 de novembro" (não "21 De Novembro")
}

/** Retrospectiva da noite: lugares, fotos e notas de uma noite, num card para compartilhar. */
export default function RecapScreen() {
  const { username, d } = useLocalSearchParams<{ username: string; d?: string }>();
  const prof = useAsync(() => repositories.profiles.getByUsername(username), [username]);
  const posts = useAsync(async () => (prof.data ? repositories.posts.listByAuthor(prof.data.profile.id) : []), [prof.data?.profile.id]);

  const nights = useMemo(() => {
    const m = new Map<string, PostView[]>();
    for (const p of posts.data ?? []) {
      const k = nightKey(p);
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [posts.data]);
  const [picked, setPicked] = useState<string | null>(d ?? null);
  const key = picked && nights.some(([k]) => k === picked) ? picked : nights[0]?.[0];
  const night = nights.find(([k]) => k === key)?.[1] ?? [];

  if (prof.loading || posts.loading) return <Screen><View style={styles.pad}><Skeleton height={420} rounded={radius.xl} /></View></Screen>;
  if (!prof.data) return <Screen><StateView title="Perfil não encontrado" /></Screen>;
  const p = prof.data.profile;
  if (!nights.length || !key) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Retrospectiva' }} />
        <StateView icon={<MoonStar size={26} color={colors.textSecondary} />} title="Nenhuma noite registrada ainda"
          description="Poste fotos dos seus rolês e a retrospectiva da noite aparece aqui." actionLabel="Postar" onAction={() => router.push('/compose')} />
      </Screen>
    );
  }

  const places = [...new Set(night.map((x) => x.event?.venueName ?? x.event?.title ?? x.placeName).filter(Boolean))] as string[];
  const rated = night.filter((x) => x.rating != null);
  const avg = rated.length ? rated.reduce((a, x) => a + (x.rating ?? 0), 0) / rated.length : null;
  const photos = night.flatMap((x) => x.photos).slice(0, 4);
  const likes = night.reduce((a, x) => a + x.likesCount, 0);

  return (
    <Screen bleed edges={['bottom']}>
      <Stack.Screen options={{ title: 'Retrospectiva' }} />
      <ScrollView contentContainerStyle={styles.pad}>
        {nights.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {nights.slice(0, 20).map(([k]) => (
              <Chip key={k} selected={k === key} onPress={() => setPicked(k)}
                label={new Date(`${k}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')} />
            ))}
          </ScrollView>
        ) : null}

        <Appear key={key}>
          <View style={styles.card}>
            <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="rc" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={colors.accentPink} stopOpacity="0.45" />
                  <Stop offset="0.55" stopColor={colors.accent} stopOpacity="0.18" />
                  <Stop offset="1" stopColor={colors.accentPurple} stopOpacity="0.4" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#rc)" />
            </Svg>
            <View style={styles.who}>
              <Avatar name={p.displayName} url={p.avatarUrl} seed={p.id} size={36} />
              <View>
                <Text variant="bodyStrong">{p.displayName}</Text>
                <Text variant="mono" tone="secondary">@{p.username}</Text>
              </View>
            </View>
            <Text variant="mono" tone="secondary">a noite de</Text>
            <Text variant="display">{nightLabel(key)}</Text>

            {photos.length ? (
              <View style={styles.mosaic}>
                {photos.map((ph, i) => (
                  <View key={i} style={[styles.tile, photos.length === 1 && styles.tileFull, photos.length === 3 && i === 0 && styles.tileTall]}>
                    <Image source={ph.source} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.stats}>
              <Stat value={String(places.length || '—')} label={places.length === 1 ? 'lugar' : 'lugares'} />
              <Stat value={avg != null ? formatRating(Math.round(avg * 2) / 2) : '—'} label="nota média" />
              <Stat value={String(night.length)} label={night.length === 1 ? 'post' : 'posts'} />
              <Stat value={String(likes)} label="curtidas" />
            </View>
            {avg != null ? <RatingStars value={Math.round(avg * 2) / 2} size={16} /> : null}
            {places.length ? (
              <View style={styles.places}>
                {places.map((pl, i) => (
                  <Text key={pl} variant="bodyStrong">{i + 1}. {pl}</Text>
                ))}
              </View>
            ) : null}
            <Text variant="mono" tone="secondary" style={styles.brand}>fomo · o rolê que você não pode perder</Text>
          </View>
        </Appear>

        <Button label="Compartilhar a noite" icon={<Share2 size={18} color={colors.text} />} fullWidth
          onPress={() => void shareContent(`Minha noite de ${nightLabel(key)} no FOMO`, publicUrl(`/recap/${p.username}?d=${key}`))} />

        <Text variant="mono" tone="muted">posts da noite</Text>
        {night.map((x) => (
          <PressableScale key={x.id} style={styles.row} scaleTo={0.98} onPress={() => router.push({ pathname: '/post/[id]', params: { id: x.id } })}>
            {x.photos[0] ? <Image source={x.photos[0].source} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.noThumb]}><MoonStar size={18} color={colors.textMuted} /></View>}
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>{x.event?.title ?? x.placeName ?? 'Sem lugar'}</Text>
              <Text tone="secondary" numberOfLines={1}>{x.body ?? ''}</Text>
            </View>
            {x.rating != null ? <Text variant="mono">★ {formatRating(x.rating)}</Text> : null}
          </PressableScale>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="headline">{value}</Text>
      <Text variant="mono" tone="secondary">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
  chips: { gap: spacing.sm },
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(232,54,140,0.4)' },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: spacing.sm, borderRadius: radius.lg, overflow: 'hidden' },
  tile: { width: '49%', aspectRatio: 1, backgroundColor: colors.surfaceRaised, flexGrow: 1 },
  tileFull: { width: '100%', aspectRatio: 4 / 3 },
  tileTall: { width: '100%', aspectRatio: 2 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  stat: { alignItems: 'flex-start', gap: 2 },
  places: { gap: 4, marginTop: spacing.sm },
  brand: { marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 52, height: 52, borderRadius: radius.md },
  noThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  flex: { flex: 1, gap: 2 },
});
