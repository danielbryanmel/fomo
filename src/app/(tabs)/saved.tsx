import { Appear } from '@/components/motion';
import { Text } from '@/components/ui/Text';
import { GroupCard } from '@/components/group/GroupCard';
import { FomoSaveIcon } from '@/components/icons/FomoIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { EventCard, EventCardSkeleton } from '@/components/event/EventCard';
import { PostCard, PostCardSkeleton } from '@/components/post/PostCard';
import { Screen, ScreenHeader, TextTabs, StateView } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, spacing, TAB_BAR_SPACE } from '@/theme';
import type { PostView } from '@/types/domain';

type Tab = 'events' | 'posts';

export default function SavedScreen() {
  const [tab, setTab] = useState<Tab>('events');
  const events = useAsync(() => repositories.events.listSaved(), []);
  const posts = useAsync(() => repositories.posts.listSaved(), []);
  const groups = useAsync(() => repositories.groups.mine(), []);

  // recarrega ao voltar para a aba (itens salvos em outras telas)
  useFocusEffect(
    useCallback(() => {
      void events.refresh();
      void posts.refresh();
      void groups.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const update = (p: PostView) =>
    posts.setData((list) => (p.savedByMe ? list?.map((x) => (x.id === p.id ? p : x)) : list?.filter((x) => x.id !== p.id)));

  const current = tab === 'events' ? events : posts;
  const empty = !current.loading && (current.data ?? []).length === 0;

  return (
    <Screen bleed>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={current.refreshing} onRefresh={current.refresh} tintColor={colors.accentPink} />}
      >
        <ScreenHeader title="Quero ir" subtitle="Rolês que você guardou. Só você vê." />
        {(groups.data ?? []).length ? (
          <View style={styles.groups}>
            <Text variant="section">Convites e grupos</Text>
            {groups.data!.map((g, i) => (
              <Appear key={g.id} index={i}>
                <GroupCard group={g} onChange={(ng) => groups.setData((l) => l?.map((x) => (x.id === ng.id ? ng : x)))} />
              </Appear>
            ))}
          </View>
        ) : null}
        <TextTabs tabs={[{ key: 'events' as Tab, label: `Rolês salvos${events.data?.length ? ` · ${events.data.length}` : ''}` }, { key: 'posts' as Tab, label: 'Publicações' }]} value={tab} onChange={setTab} />
        <View style={styles.list}>
          {current.loading && !current.data ? (tab === 'events' ? <EventCardSkeleton /> : <PostCardSkeleton />) : null}
          {current.error ? (
            <StateView tone="error" title="Não foi possível carregar" actionLabel="Tentar de novo" onAction={current.refresh} />
          ) : null}
          {empty ? (
            <StateView
              icon={<FomoSaveIcon size={28} color={colors.textSecondary} />}
              title={tab === 'events' ? 'Nenhum evento salvo' : 'Nenhuma publicação salva'}
              description="Toque no ícone de salvar para guardar e encontrar depois."
            />
          ) : null}
          {tab === 'events' && events.data?.map((e, i) => <Appear key={e.id} index={i}><EventCard event={e} /></Appear>)}
          {tab === 'posts' && posts.data?.map((p, i) => <Appear key={p.id} index={i}><PostCard post={p} onChange={update} /></Appear>)}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.md, marginBottom: spacing.sm },
  content: { paddingHorizontal: spacing.lg, paddingBottom: TAB_BAR_SPACE + spacing.xl, flexGrow: 1 },
  list: { gap: spacing.md, paddingTop: spacing.lg, flexGrow: 1 },
});
