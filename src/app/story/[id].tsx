import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Eye, Heart, MapPin, SendHorizontal, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PersonRow } from '@/components/profile/PersonRow';
import { ActionSheet, Avatar, Skeleton, StateView, Text, useToast } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { storyCache } from '@/features/stories';
import { formatRelative } from '@/lib/format';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { StoryGroup, UserProfile } from '@/types/domain';

const DURATION = 5000;
const TICK = 50;

/** Visualizador de stories: toque à direita avança, à esquerda volta, segurar pausa. */
export default function StoryViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const toast = useToast();
  const [groups, setGroups] = useState<StoryGroup[]>(storyCache.get());
  const [gi, setGi] = useState(-1);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const paused = useRef(false);
  const [viewers, setViewers] = useState<{ profile: UserProfile; viewedAt: string; liked: boolean }[] | null>(null);
  const [reply, setReply] = useState('');
  const [typing, setTyping] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const heart = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));
  const [confirm, setConfirm] = useState(false);

  // abre no autor pedido, no primeiro story ainda não visto
  useEffect(() => {
    let alive = true;
    (async () => {
      let g = storyCache.get();
      if (!g.some((x) => x.author.id === id)) {
        try {
          g = await repositories.stories.tray();
          storyCache.set(g);
        } catch {
          g = [];
        }
      }
      if (!alive) return;
      setGroups(g);
      const i = g.findIndex((x) => x.author.id === id);
      setGi(i);
      if (i >= 0) setSi(Math.max(0, g[i]!.stories.findIndex((s) => !s.seen)));
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/feed')), []);
  const group = gi >= 0 ? groups[gi] : undefined;
  const story = group?.stories[si];
  const mine = !!group && group.author.id === auth.profile?.id;

  const next = useCallback(() => {
    setProgress(0);
    if (!group) return;
    if (si < group.stories.length - 1) return setSi(si + 1);
    if (gi < groups.length - 1) {
      setGi(gi + 1);
      setSi(Math.max(0, groups[gi + 1]!.stories.findIndex((s) => !s.seen)));
      return;
    }
    close();
  }, [group, gi, si, groups, close]);
  const prev = useCallback(() => {
    setProgress(0);
    if (si > 0) return setSi(si - 1);
    if (gi > 0) {
      setGi(gi - 1);
      setSi(0);
    }
  }, [gi, si]);

  // marca como visto (no banco e na bandeja)
  useEffect(() => {
    if (!story || mine || story.seen) return;
    storyCache.markSeen(story.id);
    void repositories.stories.view(story.id).catch(() => {});
  }, [story, mine]);

  // relógio do story
  useEffect(() => {
    if (!story || viewers || confirm || typing) return;
    const t = setInterval(() => {
      if (paused.current) return;
      setProgress((p) => {
        const n = p + TICK / DURATION;
        if (n >= 1) {
          setTimeout(next, 0);
          return 1;
        }
        return n;
      });
    }, TICK);
    return () => clearInterval(t);
  }, [story, next, viewers, confirm, typing]);

  async function openViewers() {
    if (!story) return;
    paused.current = true;
    try {
      setViewers(await repositories.stories.viewers(story.id));
    } catch {
      setViewers([]);
    }
  }

  const liked = story ? (likedMap[story.id] ?? story.liked) : false;
  async function toggleLike() {
    if (!story) return;
    const id = story.id;
    const prev = liked;
    setLikedMap((m) => ({ ...m, [id]: !prev }));
    if (!prev) heart.value = withSequence(withSpring(1.35, { damping: 6 }), withSpring(1));
    try {
      const v = await repositories.stories.like(id);
      setLikedMap((m) => ({ ...m, [id]: v }));
    } catch {
      setLikedMap((m) => ({ ...m, [id]: prev }));
      toast('Não foi possível curtir agora.', 'error');
    }
  }

  async function sendReply() {
    if (!story || !reply.trim()) return;
    const body = reply.trim();
    setReply('');
    try {
      await repositories.stories.reply(story.id, body);
      toast(`Resposta enviada no direct de ${group?.author.username ?? ''}`, 'success');
    } catch (e) {
      setReply(body);
      toast(e instanceof Error ? e.message : 'Não foi possível enviar.', 'error');
    }
  }

  async function remove() {
    if (!story || !group) return;
    try {
      await repositories.stories.remove(story.id);
      const left = group.stories.filter((s) => s.id !== story.id);
      const ng = left.length ? groups.map((g, i) => (i === gi ? { ...g, stories: left } : g)) : groups.filter((_, i) => i !== gi);
      storyCache.set(ng);
      storyCache.changed();
      toast('Story apagado.', 'neutral');
      if (!left.length) return close();
      setGroups(ng);
      setSi(Math.min(si, left.length - 1));
      setProgress(0);
    } catch {
      toast('Não foi possível apagar.', 'error');
    }
  }

  if (gi === -1 && !groups.length) {
    return <View style={styles.root}><Stack.Screen options={{ headerShown: false }} /><View style={[styles.pad, { paddingTop: insets.top + 60 }]}><Skeleton height={500} /></View></View>;
  }
  if (!group || !story) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <StateView title="Story indisponível" description="Ele pode ter expirado (stories duram 24 h)." actionLabel="Voltar" onAction={close} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <Image source={story.photo} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} accessibilityLabel={story.caption ?? `Story de ${group.author.displayName}`} />

      {/* toque: esquerda volta, direita avança; segurar pausa */}
      <View style={[StyleSheet.absoluteFill, styles.taps]}>
        <Pressable style={styles.tapLeft} onPress={prev} onPressIn={() => (paused.current = true)} onPressOut={() => (paused.current = false)} accessibilityLabel="Story anterior" />
        <Pressable style={styles.tapRight} onPress={next} onPressIn={() => (paused.current = true)} onPressOut={() => (paused.current = false)} accessibilityLabel="Próximo story" />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.bars}>
          {group.stories.map((s, i) => (
            <View key={s.id} style={styles.bar}>
              <View style={[styles.barFill, { width: `${(i < si ? 1 : i === si ? progress : 0) * 100}%` }]} />
            </View>
          ))}
        </View>
        <View style={styles.who}>
          <Pressable style={styles.author} onPress={() => router.push({ pathname: '/u/[username]', params: { username: group.author.username } })} accessibilityRole="link">
            <Avatar name={group.author.displayName} url={group.author.avatarUrl} seed={group.author.id} size={34} />
            <Text variant="bodyStrong" style={styles.shadow}>{mine ? 'Seu story' : group.author.username}</Text>
            <Text variant="mono" style={[styles.dim, styles.shadow]}>{formatRelative(story.createdAt)}</Text>
          </Pressable>
          <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}>
            <X size={24} color={colors.text} />
          </Pressable>
        </View>
        {story.event ? (
          <Pressable style={styles.event} onPress={() => router.push({ pathname: '/event/[id]', params: { id: story.event!.id } })} accessibilityRole="link">
            <MapPin size={13} color={colors.text} />
            <Text variant="caption" numberOfLines={1}>{story.event.title}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
        {story.caption ? <Text variant="body" style={[styles.caption, styles.shadow]}>{story.caption}</Text> : null}
        {mine ? (
          <View style={styles.ownRow}>
            <Pressable style={styles.pill} onPress={openViewers} accessibilityRole="button">
              <Eye size={16} color={colors.text} />
              <Text variant="bodyStrong">{story.views ?? 0} {story.views === 1 ? 'visualização' : 'visualizações'}</Text>
              {story.likes ? (
                <>
                  <Heart size={14} color={colors.accentPink} fill={colors.accentPink} />
                  <Text variant="bodyStrong">{story.likes}</Text>
                </>
              ) : null}
            </Pressable>
            <Pressable style={styles.pill} onPress={() => { paused.current = true; setConfirm(true); }} accessibilityRole="button" accessibilityLabel="Apagar story">
              <Trash2 size={16} color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.replyRow}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              placeholder={`Responder ${group.author.username}…`}
              placeholderTextColor="rgba(255,255,255,0.7)"
              style={styles.replyInput}
              maxLength={500}
              onSubmitEditing={sendReply}
              returnKeyType="send"
              accessibilityLabel="Responder ao story"
            />
            {reply.trim() ? (
              <Pressable onPress={sendReply} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Enviar resposta">
                <SendHorizontal size={22} color={colors.text} />
              </Pressable>
            ) : (
              <Pressable onPress={toggleLike} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={liked ? 'Descurtir story' : 'Curtir story'} accessibilityState={{ selected: liked }}>
                <Animated.View style={heartStyle}>
                  <Heart size={26} color={liked ? colors.accentPink : colors.text} fill={liked ? colors.accentPink : 'transparent'} />
                </Animated.View>
              </Pressable>
            )}
          </KeyboardAvoidingView>
        )}
      </View>

      <Modal visible={!!viewers} transparent animationType="slide" onRequestClose={() => { setViewers(null); paused.current = false; }}>
        <Pressable style={styles.backdrop} onPress={() => { setViewers(null); paused.current = false; }} accessibilityLabel="Fechar lista" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text variant="headline">Quem viu</Text>
          <FlatList
            data={viewers ?? []}
            keyExtractor={(v) => v.profile.id}
            renderItem={({ item }) => (
              <PersonRow person={item.profile} subtitle={formatRelative(item.viewedAt)}
                right={item.liked ? <Heart size={18} color={colors.accentPink} fill={colors.accentPink} accessibilityLabel="Curtiu" /> : undefined} />
            )}
            ListEmptyComponent={<Text tone="muted">Ninguém viu ainda.</Text>}
          />
        </View>
      </Modal>
      <ActionSheet
        visible={confirm}
        onClose={() => { setConfirm(false); paused.current = false; }}
        title="Apagar este story?"
        actions={[{ label: 'Apagar', destructive: true, onPress: remove }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  pad: { padding: spacing.lg },
  taps: { flexDirection: 'row' },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: spacing.md, gap: spacing.sm },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: colors.text },
  who: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  dim: { color: 'rgba(255,255,255,0.75)' },
  shadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  event: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.5)', maxWidth: 260 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, gap: spacing.md },
  caption: { fontSize: 17 },
  ownRow: { flexDirection: 'row', gap: spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)' },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  replyInput: { outlineStyle: 'none' as never, flex: 1, minHeight: 46, paddingHorizontal: spacing.lg, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', color: colors.text, fontSize: 16, backgroundColor: 'rgba(0,0,0,0.25)' },
  iconBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '60%', padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface },
});
