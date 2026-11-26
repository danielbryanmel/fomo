import { router, useFocusEffect } from 'expo-router';
import { MessageSquareDashed, SquarePen, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Appear, PressableScale } from '@/components/motion';
import { GroupAvatar } from '@/components/messages/GroupAvatar';
import { Avatar, Button, Chip, Screen, Skeleton, StateView, Text } from '@/components/ui';
import type { ConversationPreview } from '@/types/domain';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/lib/format';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';

type Filter = 'all' | 'following' | 'requests';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'following', label: 'Quem eu sigo' },
  { key: 'requests', label: 'Solicitações' },
];
/** Solicitação = alguém que eu não sigo e para quem ainda não respondi. */
const isRequest = (c: ConversationPreview) => !c.iFollow && !c.replied;
const EMPTY: Record<Filter, { title: string; description: string }> = {
  all: { title: 'Nenhuma conversa ainda', description: 'Abra o perfil de alguém e toque em Mensagem para combinar o rolê.' },
  following: { title: 'Nada de quem você segue', description: 'As conversas com quem você segue aparecem aqui.' },
  requests: { title: 'Sem solicitações', description: 'Mensagens de quem você não segue chegam aqui até você responder.' },
};

/** Caixa de entrada do direct, com filtro: todas / quem eu sigo / solicitações. */
export default function InboxScreen() {
  const auth = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const inbox = useAsync(() => repositories.messages.inbox(), []);
  useFocusEffect(useCallback(() => void inbox.refresh(), [])); // eslint-disable-line react-hooks/exhaustive-deps

  if (inbox.loading && !inbox.data) {
    return <Screen edges={['bottom']}><View style={styles.pad}>{[0, 1, 2].map((i) => <Skeleton key={i} height={60} />)}</View></Screen>;
  }
  const all = inbox.data ?? [];
  const requests = all.filter(isRequest).length;
  const items = filter === 'all' ? all : filter === 'following' ? all.filter((c) => c.iFollow) : all.filter(isRequest);
  return (
    <Screen bleed edges={['bottom']}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersWrap} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} selected={filter === f.key} onPress={() => setFilter(f.key)}
            label={f.key === 'requests' && requests ? `${f.label} · ${requests}` : f.label} />
        ))}
      </ScrollView>
      {items.length === 0 ? (
        <StateView
          icon={<MessageSquareDashed size={26} color={colors.textSecondary} />}
          title={EMPTY[filter].title}
          description={EMPTY[filter].description}
          actionLabel={filter === 'all' ? 'Buscar pessoas' : undefined}
          onAction={filter === 'all' ? () => router.push('/people') : undefined}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.pad}
          renderItem={({ item, index }) => {
            const mine = item.last?.senderId === auth.profile?.id;
            const name = item.isGroup ? (item.title ?? 'Grupo') : (item.other?.username ?? 'conta removida');
            const who = mine ? 'Você: ' : item.isGroup && item.last?.senderName ? `${item.last.senderName}: ` : '';
            const preview = item.last ? `${item.last.replyLabel && !item.isGroup ? '↩ story · ' : ''}${item.last.body}` : `${item.memberCount} pessoas · diga oi`;
            return (
              <Appear index={index}>
                <PressableScale style={[styles.row, item.unread && styles.unread]} scaleTo={0.98}
                  onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })}
                  accessibilityRole="button" accessibilityLabel={`${item.isGroup ? 'Grupo' : 'Conversa com'} ${name}${item.unread ? ', não lida' : ''}`}>
                  {item.isGroup ? <GroupAvatar members={item.members} /> : <Avatar name={item.other?.displayName ?? '?'} url={item.other?.avatarUrl ?? null} seed={item.other?.id ?? item.id} size={48} />}
                  <View style={styles.text}>
                    <View style={styles.nameRow}>
                      <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>{name}</Text>
                      {item.isGroup ? <Text variant="mono" tone="muted">{item.memberCount}</Text> : null}
                      {isRequest(item) ? <Text variant="mono" tone="muted" style={styles.tag}>solicitação</Text> : null}
                    </View>
                    <Text tone={item.unread ? 'primary' : 'muted'} numberOfLines={1} style={item.unread && styles.bold}>
                      {who}{preview}
                    </Text>
                  </View>
                  <View style={styles.meta}>
                    <Text variant="mono" tone="muted">{formatRelative(item.lastAt)}</Text>
                    {item.unread ? <View style={styles.dot} /> : null}
                  </View>
                </PressableScale>
              </Appear>
            );
          }}
        />
      )}
      <View style={styles.fab}>
        <Button label="Novo grupo" variant="secondary" icon={<Users size={18} color={colors.text} />} onPress={() => router.push('/messages/new-group')} />
        <Button label="Nova conversa" icon={<SquarePen size={18} color={colors.text} />} onPress={() => router.push('/people')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, paddingBottom: 120 },
  filtersWrap: { flexGrow: 0 },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shrink: { flexShrink: 1 },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2 },
  unread: {},
  text: { flex: 1, gap: 2 },
  bold: { fontWeight: '600' },
  meta: { alignItems: 'flex-end', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accentPink },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.xl, flexDirection: 'row', gap: spacing.sm },
});
