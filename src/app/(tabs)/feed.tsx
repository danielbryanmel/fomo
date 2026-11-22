import { router, useLocalSearchParams } from 'expo-router';
import { Newspaper, UserPlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { postCreated } from '@/lib/bus';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { PostCard, PostCardSkeleton } from '@/components/post/PostCard';
import { Chip, NotificationBell, Screen, ScreenHeader, StateView, Text } from '@/components/ui';
import { Appear } from '@/components/motion';
import { usePaginated } from '@/hooks/usePaginated';
import { repositories } from '@/repositories';
import { colors, spacing, TAB_BAR_SPACE } from '@/theme';
import type { FeedTab, PostView } from '@/types/domain';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'for_you', label: 'Para você' },
  { key: 'following', label: 'Seguindo' },
];

/** Feed misto (decisão V2). Ordenação "Para você" explicável — ver docs/DATA_MODEL.md. */
export default function FeedScreen() {
  const params = useLocalSearchParams<{ tab?: FeedTab }>();
  const [tab, setTab] = useState<FeedTab>(params.tab === 'following' ? 'following' : 'for_you');
  useEffect(() => {
    if (params.tab === 'following' || params.tab === 'for_you') setTab(params.tab);
  }, [params.tab]);
  const feed = usePaginated((cursor) => repositories.posts.feed(tab, cursor), [tab]);

  // post recém-publicado aparece no topo sem recarregar
  useEffect(() => postCreated.on((p) => feed.setItems((list) => [p, ...list.filter((x) => x.id !== p.id)])), [feed.setItems]);

  const update = (p: PostView) => feed.setItems((list) => list.map((x) => (x.id === p.id ? p : x)));
  const removed = (id: string) => feed.setItems((list) => list.filter((x) => x.id !== id));

  return (
    <Screen bleed>
      <FlatList
        data={feed.items}
        keyExtractor={(p) => p.id}
        renderItem={({ item, index }) => (
          <Appear index={index < 6 ? index : 0} kind={index < 6 ? 'up' : 'fade'}>
            <PostCard post={item} onChange={update} onRemoved={removed} />
          </Appear>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader title="Feed" trailing={<NotificationBell />} />
            <View style={styles.tabs} accessibilityRole="tablist">
              {TABS.map((t) => (
                <Chip key={t.key} label={t.label} selected={tab === t.key} onPress={() => setTab(t.key)} />
              ))}
            </View>
            {tab === 'for_you' ? (
              <Text variant="caption" tone="muted">Ordenado por atualidade, qualidade de quem publica e interesse — curtidas pesam pouco.</Text>
            ) : null}
          </View>
        }
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={feed.refresh} tintColor={colors.accentPink} />}
        ListEmptyComponent={
          feed.loading ? (
            <View style={styles.gap}>
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </View>
          ) : feed.error ? (
            <StateView tone="error" title="Não foi possível carregar o feed" description="Verifique sua conexão e tente de novo." actionLabel="Tentar de novo" onAction={feed.retry} />
          ) : tab === 'following' ? (
            <StateView
              icon={<UserPlus size={26} color={colors.textSecondary} />}
              title="Siga pessoas para ver os rolês delas"
              description="Publicações de quem você segue aparecem aqui, das mais recentes para as mais antigas."
              actionLabel="Descobrir pessoas"
              onAction={() => setTab('for_you')}
            />
          ) : (
            <StateView
              icon={<Newspaper size={26} color={colors.textSecondary} />}
              title="Nada por aqui ainda"
              description="Seja a primeira pessoa a contar um rolê."
              actionLabel="Publicar"
              onAction={() => router.push('/publish')}
            />
          )
        }
        ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={colors.accentPink} style={styles.footer} /> : undefined}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: TAB_BAR_SPACE + spacing.xl },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  gap: { gap: spacing.md },
  footer: { marginVertical: spacing.lg },
});
