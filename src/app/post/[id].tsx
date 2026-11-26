import { router, useLocalSearchParams } from 'expo-router';
import { FileQuestion } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentComposer, CommentList, useComments } from '@/features/comments/Comments';
import { PostCard, PostCardSkeleton } from '@/components/post/PostCard';
import { Screen, StateView } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, spacing } from '@/theme';

export default function PostDetailScreen() {
  const { id, comentar } = useLocalSearchParams<{ id: string; comentar?: string }>();
  const post = useAsync(() => repositories.posts.getById(id), [id]);
  const comments = useComments(id, (d) => post.setData((p) => (p ? { ...p, commentsCount: Math.max(0, p.commentsCount + d) } : p)));
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const insets = useSafeAreaInsets();

  const focusComment = () => {
    scroll.current?.scrollToEnd({ animated: true });
    setTimeout(() => input.current?.focus(), 120);
  };
  // veio do ícone de comentário no feed: já abre com o teclado no campo
  useEffect(() => {
    if (comentar && post.data) focusComment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comentar, !!post.data]);

  return (
    <Screen bleed edges={[]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                onCommentPress={focusComment}
                onChange={(p) => post.setData(() => p)}
                onRemoved={() => (router.canGoBack() ? router.back() : router.replace('/feed'))}
              />
              <CommentList state={comments} onEmptyPress={focusComment} />
            </>
          ) : null}
        </ScrollView>
        {post.data ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <CommentComposer ref={input} state={comments} onSent={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80)} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  flex: { flex: 1, minHeight: 0 },
  footer: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});
