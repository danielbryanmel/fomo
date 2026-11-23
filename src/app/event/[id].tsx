import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { FomoSaveIcon } from '@/components/icons/FomoIcons';
import { CalendarX, ChevronLeft, ImagePlus, MapPinned, Navigation, Share2, Star, Ticket } from 'lucide-react-native';
import { type ReactNode, useCallback, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FriendsGoing } from '@/components/event/FriendsGoing';
import { PresenceRow } from '@/components/event/PresenceRow';
import { LiveStatusCard } from '@/components/live/LiveStatusCard';
import { NightChart } from '@/components/live/NightChart';
import { StatTile } from '@/components/live/StatTile';
import { PostCard } from '@/components/post/PostCard';
import { RatingStars } from '@/components/post/RatingStars';
import { Appear } from '@/components/motion';
import { Ambient, Avatar, Button, Screen, Skeleton, StateView, Text, useToast } from '@/components/ui';
import { MUSIC_LABEL, QUEUE_HINT, QUEUE_LABEL, VIBE_LABEL } from '@/config/live';
import { useAsync } from '@/hooks/useAsync';
import { checkinOpen, formatHours, isHappeningNow } from '@/lib/events';
import { openDirections, openExternal, publicUrl, shareContent } from '@/lib/external';
import { formatEventDate, formatPrice, formatRelative } from '@/lib/format';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { PostView } from '@/types/domain';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const event = useAsync(() => repositories.events.getById(id), [id]);
  const live = useAsync(() => repositories.live.status(id), [id]);
  const reviews = useAsync(() => repositories.events.listReviews(id), [id]);
  // volta da tela de avaliação com a lista atualizada
  const seen = useRef(false);
  const refreshReviews = reviews.refresh;
  useFocusEffect(useCallback(() => {
    if (seen.current) void refreshReviews();
    seen.current = true;
  }, [refreshReviews]));
  const posts = useAsync(() => repositories.posts.listByEvent(id), [id]);
  const friends = useAsync(() => repositories.groups.friendsGoing(id).catch(() => []), [id]);
  const presence = useAsync(() => repositories.checkins.presence(id).catch(() => null), [id]);
  // volta do check-in já atualizado
  const refreshPresence = presence.refresh;
  useFocusEffect(useCallback(() => { void refreshPresence(); }, [refreshPresence]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (event.loading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.skeleton}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="80%" height={40} />
          <Skeleton height={180} rounded={radius.lg} />
          <Skeleton height={90} rounded={radius.md} />
        </View>
      </Screen>
    );
  }
  if (event.error) return <Screen><Stack.Screen options={{ headerShown: false }} /><StateView tone="error" title="Não foi possível carregar o evento" actionLabel="Tentar de novo" onAction={event.refresh} /></Screen>;
  const e = event.data;
  if (!e) return <Screen><Stack.Screen options={{ headerShown: false }} /><StateView icon={<CalendarX size={26} color={colors.textSecondary} />} title="Evento não encontrado" description="Ele pode ter sido removido ou ainda está em moderação." actionLabel="Voltar" onAction={back} /></Screen>;

  const now = isHappeningNow(e);
  const ended = e.status === 'ended' || e.status === 'cancelled';
  const s = live.data;

  async function toggleSave() {
    const saved = !e!.savedByMe;
    event.setData((x) => (x ? { ...x, savedByMe: saved } : x));
    try {
      await repositories.events.toggleSave(e!.id);
      toast(saved ? 'Salvo' : 'Removido dos salvos', 'success');
    } catch {
      event.setData((x) => (x ? { ...x, savedByMe: !saved } : x));
      toast('Não foi possível salvar agora.', 'error');
    }
  }
  async function share() {
    const ok = await shareContent(e!.title, publicUrl(`/event/${e!.id}`));
    if (!ok) toast('Compartilhamento indisponível neste dispositivo.');
  }
  const updatePost = (p: PostView) => posts.setData((l) => l?.map((x) => (x.id === p.id ? p : x)));
  const avg = reviews.data?.length ? reviews.data.reduce((a, r) => a + r.rating, 0) / reviews.data.length : null;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <Ambient variant="top" intensity={0.8} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 110 }}>
        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <Text variant="mono" tone="secondary">
              {[e.category.name, formatHours(e), e.isSponsored ? 'patrocinado' : null, e.isDemo ? 'demo · local fictício' : null, e.status === 'pending' ? 'em moderação' : null, ended ? (e.status === 'cancelled' ? 'cancelado' : 'encerrado') : null].filter(Boolean).join(' · ')}
            </Text>
            <Text variant="hero" accessibilityRole="header">{e.title}</Text>
            <Text variant="mono" tone="muted">{[e.venueName, e.address].filter(Boolean).join(' · ') || 'local a confirmar'}</Text>
          </View>

          {now && s ? <LiveStatusCard status={s} /> : null}
          {now && live.loading ? <Skeleton height={190} rounded={radius.lg} /> : null}
          {!now && !ended ? (
            <View style={styles.upcoming}>
              <Text variant="mono" tone="muted">quando</Text>
              <Text variant="display">{formatEventDate(e.startsAt)}</Text>
              <Text variant="caption" tone="secondary">O termômetro ao vivo liga quando o rolê começar.</Text>
            </View>
          ) : null}

          {checkinOpen(e) ? <PresenceRow eventId={e.id} presence={presence.data ?? null} /> : null}
          {!ended && friends.data?.length ? <FriendsGoing people={friends.data} /> : null}

          <View style={styles.grid}>
            {now && s?.crowd ? (
              <>
                <StatTile label="vibe" value={s.vibe ? VIBE_LABEL[s.vibe] : '—'} detail="maioria dos relatos" />
                <StatTile label="música" value={s.music ? MUSIC_LABEL[s.music] : '—'} detail={s.music ? 'segundo quem está lá' : 'sem dados'} />
                <StatTile label="fila" value={s.queue ? QUEUE_LABEL[s.queue] : '—'} detail={s.queue ? QUEUE_HINT[s.queue] : undefined} />
              </>
            ) : null}
            <StatTile label="entrada" value={formatPrice(e.priceMinCents, e.priceMaxCents)} detail={e.ticketUrl ? 'ingresso online' : 'na porta'} />
          </View>

          {now && s?.timeline.length ? <NightChart timeline={s.timeline} /> : null}

          {e.description ? (
            <Section title="Sobre">
              <Text tone="secondary">{e.description}</Text>
            </Section>
          ) : null}

          <View style={styles.row}>
            <Button label="Como chegar" variant="secondary" icon={<Navigation size={18} color={colors.text} />} onPress={() => openDirections(e.latitude, e.longitude, e.venueName ?? e.title)} />
            {e.ticketUrl && !ended ? <Button label="Ingressos" variant="secondary" icon={<Ticket size={18} color={colors.text} />} onPress={() => openExternal(e.ticketUrl!)} /> : null}
            <Button label="Postar fotos daqui" variant="secondary" icon={<ImagePlus size={18} color={colors.text} />} onPress={() => router.push({ pathname: '/compose', params: { eventId: e.id } })} />
            {!ended ? (
              <Button label="Combinar com a galera" variant="secondary" icon={<Users size={18} color={colors.text} />} onPress={() => router.push({ pathname: '/group/new', params: { eventId: e.id } })} />
            ) : null}
          </View>

          <Section title={avg ? `Avaliações · ${avg.toFixed(1).replace('.', ',')}` : 'Avaliações'}>
            {reviews.loading ? <Skeleton height={64} rounded={radius.md} /> : null}
            {!reviews.loading && !reviews.data?.length ? <Text tone="muted">Ainda sem avaliações.</Text> : null}
            {e.status === 'approved' || e.status === 'ended' ? (
              <Button
                label="Avaliar este rolê"
                variant="secondary"
                icon={<Star size={18} color={colors.warning} />}
                onPress={() => router.push({ pathname: '/review/[id]', params: { id: e.id } })}
              />
            ) : null}
            {reviews.data?.map((r, i) => (
              <Appear key={r.id} index={i} style={styles.review}>
                <View style={styles.reviewHead}>
                  <Avatar name={r.author.displayName} url={r.author.avatarUrl} seed={r.author.id} size={28} />
                  <Text variant="bodyStrong" style={styles.flex}>{r.author.displayName}</Text>
                  <RatingStars value={r.rating} />
                </View>
                {r.body ? <Text tone="secondary">{r.body}</Text> : null}
                <Text variant="mono" tone="muted">há {formatRelative(r.createdAt)} · {r.helpfulCount} acharam útil</Text>
              </Appear>
            ))}
          </Section>

          <Section title="Quem contou como foi">
            {!posts.loading && !posts.data?.length ? <Text tone="muted">Ninguém publicou sobre este rolê ainda.</Text> : null}
            {posts.data?.map((p) => <PostCard key={p.id} post={p} onChange={updatePost} />)}
          </Section>
        </View>
      </ScrollView>

      {/* Topo: voltar / compartilhar / salvar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <GlassButton label="Voltar" onPress={back}><ChevronLeft size={22} color={colors.text} /></GlassButton>
        <View style={styles.flex} />
        <GlassButton label="Compartilhar" onPress={share}><Share2 size={18} color={colors.text} /></GlassButton>
        <GlassButton label={e.savedByMe ? 'Remover dos salvos' : 'Salvar'} onPress={toggleSave}>
          <FomoSaveIcon size={19} active={e.savedByMe} />
        </GlassButton>
      </View>

      {/* CTA único */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.flex}>
          {now ? (
            <Button label="Tô aqui · informar" icon={<MapPinned size={18} color={colors.text} />} fullWidth onPress={() => router.push({ pathname: '/report/[id]', params: { id: e.id } })} accessibilityHint="Conte a lotação, vibe e fila em três toques" />
          ) : (
            <Button label={e.savedByMe ? 'Salvo · te lembramos' : 'Salvar para depois'} variant={e.savedByMe ? 'secondary' : 'primary'} icon={<FomoSaveIcon size={19} active={e.savedByMe} />} fullWidth onPress={toggleSave} />
          )}
        </View>
        <GlassButton label="Como chegar" onPress={() => openDirections(e.latitude, e.longitude, e.venueName ?? e.title)} size={52}>
          <Navigation size={20} color={colors.text} />
        </GlassButton>
      </View>
    </View>
  );
}

function GlassButton({ children, label, onPress, size = 44 }: { children: ReactNode; label: string; onPress: () => void; size?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.glass, { width: size, height: size, borderRadius: size / 2 }, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="mono" tone="muted" accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  titleBlock: { gap: spacing.sm, marginBottom: spacing.sm },
  upcoming: { gap: spacing.xs, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  section: { gap: spacing.md, marginTop: spacing.md },
  review: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  skeleton: { gap: spacing.md, paddingTop: spacing.xxxl },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  glass: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: 'rgba(10,10,12,0.92)', borderTopWidth: 1, borderTopColor: colors.border,
  },
});
