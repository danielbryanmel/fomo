import { Link } from 'expo-router';
import { PlacesList } from '@/components/profile/PlacesList';
import { REVIEW_ASPECTS } from '@/config/live';
import { Lock, MessageSquare, Newspaper, Sparkles } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { PostCard, PostCardSkeleton } from '@/components/post/PostCard';
import { PostGrid } from '@/components/post/PostGrid';
import { postCreated } from '@/lib/bus';
import { RatingStars } from '@/components/post/RatingStars';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { Card, SegmentedTabs, StateView, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/lib/format';
import { repositories } from '@/repositories';
import { colors, spacing, TAB_BAR_SPACE } from '@/theme';
import type { PostView, ProfileView as ProfileData } from '@/types/domain';

type Tab = 'posts' | 'experiences' | 'reviews';
const TABS: { key: Tab; label: string }[] = [
  { key: 'posts', label: 'Publicações' },
  { key: 'experiences', label: 'Rolês' },
  { key: 'reviews', label: 'Avaliações' },
];

type Props = {
  data: ProfileData;
  actions?: ReactNode;
  onRefresh?: () => Promise<void>;
};

/** Conteúdo compartilhado entre "Meu perfil" e o perfil público. */
export function ProfileView({ data, actions, onRefresh }: Props) {
  const { profile, relationship } = data;
  const [tab, setTab] = useState<Tab>('posts');
  const [refreshing, setRefreshing] = useState(false);

  const posts = useAsync(() => repositories.posts.listByAuthor(profile.id), [profile.id]);
  const reviews = useAsync(() => repositories.profiles.listReviews(profile.id), [profile.id]);

  useEffect(
    () => postCreated.on((p) => p.authorId === profile.id && posts.setData((l) => [p, ...(l ?? [])])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile.id],
  );

  const update = (p: PostView) => posts.setData((list) => list?.map((x) => (x.id === p.id ? p : x)));
  const removed = (id: string) => posts.setData((list) => list?.filter((x) => x.id !== id));

  async function refresh() {
    setRefreshing(true);
    await Promise.all([onRefresh?.(), posts.refresh(), reviews.refresh()]);
    setRefreshing(false);
  }

  const experiences = (posts.data ?? []).filter((p) => p.experienceDate || p.eventId || p.placeName);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentPink} />}
    >
      <ProfileHeader profile={profile} actions={actions} />

      {!relationship.canViewContent ? (
        <StateView
          icon={<Lock size={26} color={colors.textSecondary} />}
          title="Este perfil é privado"
          description="Siga e aguarde a aprovação para ver publicações, rolês e avaliações."
        />
      ) : (
        <>
          <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
          <View style={styles.list}>
            {tab !== 'reviews' && posts.loading ? (
              <>
                <PostCardSkeleton />
                <PostCardSkeleton />
              </>
            ) : null}
            {tab !== 'reviews' && posts.error ? (
              <StateView tone="error" title="Não foi possível carregar" description={posts.error.message} actionLabel="Tentar de novo" onAction={posts.refresh} />
            ) : null}

            {tab === 'posts' && posts.data
              ? posts.data.length === 0
                ? <Empty icon={<Newspaper size={24} color={colors.textSecondary} />} text={relationship.isSelf ? 'Você ainda não publicou nada.' : 'Nenhuma publicação ainda.'} cta={relationship.isSelf} />
                : <PostGrid posts={posts.data} />
              : null}

            {tab === 'experiences' && posts.data
              ? experiences.length === 0
                ? <Empty icon={<Sparkles size={24} color={colors.textSecondary} />} text="Nenhum rolê registrado." cta={relationship.isSelf} />
                : <PlacesList posts={experiences} />
              : null}

            {tab === 'reviews' ? (
              reviews.loading ? (
                <PostCardSkeleton />
              ) : (reviews.data ?? []).length === 0 ? (
                <Empty icon={<MessageSquare size={24} color={colors.textSecondary} />} text="Nenhuma avaliação ainda." />
              ) : (
                reviews.data!.map((r) => (
                  <Card key={r.id}>
                    <View style={styles.reviewHead}>
                      <RatingStars value={r.rating} />
                      <Text variant="caption" tone="muted">{formatRelative(r.createdAt)}</Text>
                    </View>
                    {r.body ? <Text style={styles.reviewBody}>{r.body}</Text> : null}
                    {r.aspects?.length ? <Text variant="caption" tone="secondary">Pesou: {r.aspects.map((a) => REVIEW_ASPECTS[a]).join(' · ')}</Text> : null}
                    {r.eventId ? (
                      <Link href={{ pathname: '/event/[id]', params: { id: r.eventId } }}>
                        <Text variant="caption" tone="accent">Ver evento</Text>
                      </Link>
                    ) : null}
                    <Text variant="caption" tone="muted">{r.helpfulCount} pessoas acharam útil</Text>
                  </Card>
                ))
              )
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Empty({ icon, text, cta }: { icon: ReactNode; text: string; cta?: boolean }) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text tone="secondary" align="center">{text}</Text>
      {cta ? (
        <Link href="/compose">
          <Text variant="bodyStrong" tone="accent">Postar fotos de um rolê</Text>
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: TAB_BAR_SPACE + spacing.xl },
  list: { gap: spacing.md, paddingTop: spacing.lg },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewBody: { marginVertical: spacing.sm },
});
