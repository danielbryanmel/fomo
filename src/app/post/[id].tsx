import { router, useLocalSearchParams } from 'expo-router';
import { FileQuestion } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Comments } from '@/features/comments/Comments';
import { PostCard, PostCardSkeleton } from '@/components/post/PostCard';
import { Screen, StateView } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, spacing } from '@/theme';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = useAsync(() => repositories.posts.getById(id), [id]);

  return (
    <Screen bleed edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {post.loading ? <PostCardSkeleton /> : null}
        {post.error ? <StateView tone="error" title="Não foi possível carregar" actionLabel="Tentar de novo" onAction={post.refresh} /> : null}
        {!post.loading && !post.error && !post.data ? (
          <StateView
            icon={<FileQuestion size={26} color={colors.textSecondary} />}
            title="Publicação indisponível"
            description="Ela pode ter sido removida, ou é visível apenas para seguidores do autor."
          />
        ) : null}
        {post.data ? (
          <>
            <PostCard
              post={post.data}
              detail
              onChange={(p) => post.setData(() => p)}
              onRemoved={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
            />
            <Comments
              postId={post.data.id}
              onCountChange={(d) => post.setData((p) => (p ? { ...p, commentsCount: Math.max(0, p.commentsCount + d) } : p))}
            />
          </>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  flex: { flex: 1 },
});
