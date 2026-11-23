import { router, useFocusEffect } from 'expo-router';
import { MessageSquareDashed, SquarePen } from 'lucide-react-native';
import { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Appear, PressableScale } from '@/components/motion';
import { Avatar, Button, Screen, Skeleton, StateView, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/lib/format';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';

/** Caixa de entrada do direct. */
export default function InboxScreen() {
  const auth = useAuth();
  const inbox = useAsync(() => repositories.messages.inbox(), []);
  useFocusEffect(useCallback(() => void inbox.refresh(), [])); // eslint-disable-line react-hooks/exhaustive-deps

  if (inbox.loading && !inbox.data) {
    return <Screen edges={['bottom']}><View style={styles.pad}>{[0, 1, 2].map((i) => <Skeleton key={i} height={60} />)}</View></Screen>;
  }
  const items = inbox.data ?? [];
  return (
    <Screen bleed edges={['bottom']}>
      {items.length === 0 ? (
        <StateView
          icon={<MessageSquareDashed size={26} color={colors.textSecondary} />}
          title="Nenhuma conversa ainda"
          description="Abra o perfil de alguém e toque em Mensagem para combinar o rolê."
          actionLabel="Buscar pessoas"
          onAction={() => router.push('/people')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.pad}
          renderItem={({ item, index }) => {
            const mine = item.last?.senderId === auth.profile?.id;
            return (
              <Appear index={index}>
                <PressableScale style={[styles.row, item.unread && styles.unread]} scaleTo={0.98}
                  onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })}
                  accessibilityRole="button" accessibilityLabel={`Conversa com ${item.other?.displayName ?? 'alguém'}${item.unread ? ', não lida' : ''}`}>
                  <Avatar name={item.other?.displayName ?? '?'} url={item.other?.avatarUrl ?? null} seed={item.other?.id ?? item.id} size={48} />
                  <View style={styles.text}>
                    <Text variant="bodyStrong" numberOfLines={1}>{item.other?.username ?? 'conta removida'}</Text>
                    <Text tone={item.unread ? 'primary' : 'muted'} numberOfLines={1} style={item.unread && styles.bold}>
                      {mine ? 'Você: ' : ''}{item.last?.body ?? ''}
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
        <Button label="Nova conversa" icon={<SquarePen size={18} color={colors.text} />} onPress={() => router.push('/people')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 120 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  unread: { borderColor: 'rgba(232,54,140,0.45)' },
  text: { flex: 1, gap: 2 },
  bold: { fontWeight: '600' },
  meta: { alignItems: 'flex-end', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accentPink },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.xl },
});
