import { router, useFocusEffect } from 'expo-router';
import { AlarmClock, Heart, House, MessageCircleMore, Users, Vote } from 'lucide-react-native';
import { FomoCommentIcon, FomoLikeIcon } from '@/components/icons/FomoIcons';
import { Award, BellOff, CalendarCheck, ShieldCheck, UserCheck, UserPlus } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { Appear } from '@/components/motion';
import { Avatar, Button, Screen, Skeleton, StateView, Text, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/lib/format';
import { useAuth } from '@/features/auth/AuthProvider';
import { repositories } from '@/repositories';
import { colors, motion, radius, spacing } from '@/theme';
import type { NotificationType, NotificationView, UserProfile } from '@/types/domain';

const COPY: Record<NotificationType, string> = {
  follow: 'começou a seguir você',
  follow_request: 'pediu para seguir você',
  follow_accepted: 'aceitou seu pedido para seguir',
  like: 'curtiu sua publicação',
  comment: 'comentou na sua publicação',
  achievement: 'Nova conquista desbloqueada',
  event_approved: 'O rolê que você sugeriu foi aprovado e já está no mapa',
  moderation: 'Atualização da moderação sobre algo seu',
  message: 'te mandou uma mensagem',
  group_invite: 'te chamou para um grupo de rolê',
  group_response: 'respondeu ao convite do seu grupo',
  event_reminder: 'Seu rolê começa em menos de 2 h. Bora se arrumar?',
  group_poll: 'abriu uma enquete no grupo',
  arrived_home: 'avisou que chegou bem em casa',
  story_like: 'curtiu seu story',
};

const ICON: Record<NotificationType, ReactNode> = {
  follow: <UserPlus size={14} color={colors.text} />,
  follow_request: <UserPlus size={14} color={colors.text} />,
  follow_accepted: <UserCheck size={14} color={colors.text} />,
  like: <FomoLikeIcon size={14} color={colors.text} active />,
  comment: <FomoCommentIcon size={14} color={colors.text} />,
  achievement: <Award size={14} color={colors.textOnLive} />,
  event_approved: <CalendarCheck size={14} color={colors.text} />,
  moderation: <ShieldCheck size={14} color={colors.text} />,
  message: <MessageCircleMore size={14} color={colors.text} />,
  group_invite: <Users size={14} color={colors.text} />,
  group_response: <Users size={14} color={colors.text} />,
  event_reminder: <AlarmClock size={14} color={colors.text} />,
  group_poll: <Vote size={14} color={colors.text} />,
  arrived_home: <House size={14} color={colors.text} />,
  story_like: <Heart size={14} color={colors.text} />,
};

const exit = FadeOut.duration(motion.fast).reduceMotion(ReduceMotion.System);
const layout = LinearTransition.springify().damping(motion.spring.soft.damping).reduceMotion(ReduceMotion.System);

function open(n: NotificationView, meId?: string) {
  if (n.entityType === 'story') return meId ? router.push({ pathname: '/story/[id]', params: { id: meId } }) : undefined;
  if (n.entityType === 'conversation' && n.entityId) return router.push({ pathname: '/messages/[id]', params: { id: n.entityId } });
  if (n.entityType === 'group' && n.entityId) return router.push({ pathname: '/group/[id]', params: { id: n.entityId } });
  if (n.entityType === 'post' && n.entityId) return router.push({ pathname: '/post/[id]', params: { id: n.entityId } });
  if (n.entityType === 'event' && n.entityId) return router.push({ pathname: '/event/[id]', params: { id: n.entityId } });
  if (n.type === 'achievement') return router.push('/reputation');
  if (n.actor) return router.push({ pathname: '/u/[username]', params: { username: n.actor.username } });
}

/** Notificações (tempo real) + solicitações para seguir no topo. */
export default function NotificationsScreen() {
  const meId = useAuth().profile?.id;
  const toast = useToast();
  const list = useAsync(() => repositories.social.notifications(), []);
  const requests = useAsync(() => repositories.social.followRequests(), []);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  // guarda quais estavam não lidas (para destacar) e marca tudo como lido ao abrir
  useEffect(() => {
    if (!list.data) return;
    setUnreadIds((s) => (s.size ? s : new Set(list.data!.filter((n) => !n.readAt).map((n) => n.id))));
    if (list.data.some((n) => !n.readAt)) void repositories.social.markAllRead().catch(() => {});
  }, [list.data]);

  useEffect(() => repositories.social.subscribe(() => { void list.refresh(); void requests.refresh(); }), [list.refresh, requests.refresh]);
  useFocusEffect(useCallback(() => { void requests.refresh(); }, [requests.refresh]));

  async function respond(p: UserProfile, accept: boolean) {
    requests.setData((prev) => prev?.filter((x) => x.id !== p.id));
    list.setData((prev) => prev?.filter((n) => !(n.type === 'follow_request' && n.actor?.id === p.id)));
    try {
      await repositories.social.respondFollow(p.id, accept);
      toast(accept ? `${p.displayName} agora segue você` : 'Solicitação recusada', accept ? 'success' : 'neutral');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível responder.', 'error');
      void requests.refresh();
    }
  }

  const reqs = requests.data ?? [];
  // agrupa repetidas seguidas (mesma pessoa, mesmo tipo, mesmo alvo): "respondeu ao convite" 4× vira 1 linha
  const items = (list.data ?? [])
    .filter((n) => n.type !== 'follow_request')
    .reduce<(NotificationView & { times: number; ids: string[] })[]>((acc, n) => {
      const prev = acc[acc.length - 1];
      if (prev && prev.type === n.type && prev.actor?.id === n.actor?.id && prev.entityId === n.entityId) {
        prev.times += 1;
        prev.ids.push(n.id);
      } else acc.push({ ...n, times: 1, ids: [n.id] });
      return acc;
    }, []);

  return (
    <Screen bleed edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => { void list.refresh(); void requests.refresh(); }} tintColor={colors.accentPink} />}
        ListHeaderComponent={
          reqs.length ? (
            <View style={styles.section}>
              <Text variant="section">Solicitações · {reqs.length}</Text>
              {reqs.map((p, i) => (
                <Animated.View key={p.id} exiting={exit} layout={layout}>
                  <Appear index={i} style={styles.request}>
                    <Pressable style={styles.who} onPress={() => router.push({ pathname: '/u/[username]', params: { username: p.username } })} accessibilityRole="link">
                      <Avatar name={p.displayName} url={p.avatarUrl} seed={p.id} size={44} />
                      <View style={styles.flex}>
                        <Text variant="bodyStrong" numberOfLines={1}>{p.displayName}</Text>
                        <Text variant="mono" tone="muted" numberOfLines={1}>@{p.username} · nível {p.level}</Text>
                      </View>
                    </Pressable>
                    <View style={styles.reqActions}>
                      <Button label="Aceitar" onPress={() => respond(p, true)} />
                      <Button label="Recusar" variant="secondary" onPress={() => respond(p, false)} />
                    </View>
                  </Appear>
                </Animated.View>
              ))}
            </View>
          ) : undefined
        }
        renderItem={({ item: n, index }) => {
          const fresh = n.ids.some((id) => unreadIds.has(id));
          return (
            <Animated.View layout={layout}>
              <Appear index={index}>
                <Pressable onPress={() => open(n, meId)} style={({ pressed }) => [styles.row, fresh && styles.fresh, pressed && styles.pressed]} accessibilityRole="button">
                  <View>
                    {n.actor ? (
                      <Avatar name={n.actor.displayName} url={n.actor.avatarUrl} seed={n.actor.id} size={44} />
                    ) : (
                      <View style={[styles.sys, n.type === 'achievement' && styles.sysLive]}>{ICON[n.type]}</View>
                    )}
                    {n.actor ? <View style={styles.kind}>{ICON[n.type]}</View> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text numberOfLines={3}>
                      {n.actor ? <Text variant="bodyStrong">{n.actor.username} </Text> : null}
                      {COPY[n.type]}
                      {n.times > 1 ? <Text tone="muted">{` · ${n.times}×`}</Text> : null}
                    </Text>
                    <Text variant="mono" tone="muted">{formatRelative(n.createdAt) === 'agora' ? 'agora' : `há ${formatRelative(n.createdAt)}`}</Text>
                  </View>
                  {fresh ? <View style={styles.dot} accessibilityLabel="não lida" /> : null}
                </Pressable>
              </Appear>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          list.loading ? (
            <View style={styles.section}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.row}>
                  <Skeleton width={44} height={44} rounded={radius.pill} />
                  <View style={[styles.flex, { gap: spacing.xs }]}><Skeleton width="70%" /><Skeleton width="25%" height={10} /></View>
                </View>
              ))}
            </View>
          ) : list.error ? (
            <StateView tone="error" title="Não foi possível carregar" actionLabel="Tentar de novo" onAction={list.refresh} />
          ) : reqs.length ? undefined : (
            <StateView icon={<BellOff size={26} color={colors.textSecondary} />} title="Tudo em dia" description="Curtidas, comentários e novos seguidores aparecem aqui na hora." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xs, flexGrow: 1 },
  section: { gap: spacing.md, marginBottom: spacing.lg },
  request: { gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reqActions: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  fresh: { backgroundColor: 'rgba(201,56,174,0.08)' },
  pressed: { backgroundColor: colors.pressed },
  flex: { flex: 1, gap: 2 },
  sys: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  sysLive: { backgroundColor: colors.live, borderColor: colors.live },
  kind: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPink, borderWidth: 2, borderColor: colors.background },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentPink },
});
