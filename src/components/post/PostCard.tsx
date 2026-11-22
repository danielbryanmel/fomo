import { Link, router } from 'expo-router';
import { DemoTag } from '@/components/ui/DemoTag';
import { Flag, MapPin, MoreHorizontal, Trash2 } from 'lucide-react-native';
import { FomoCommentIcon, FomoLikeIcon, FomoSaveIcon, FomoShareIcon } from '@/components/icons/FomoIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AnimatedCount } from '@/components/motion';
import { LevelBadge } from '@/components/profile/LevelBadge';
import { ActionSheet, Avatar, IconButton, Skeleton, Text } from '@/components/ui';
import { usePostActions } from '@/features/posts/usePostActions';
import { formatCount, formatDay, formatRelative } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';
import type { PostView } from '@/types/domain';
import { PhotoCarousel } from './PhotoCarousel';
import { PresenceBadge } from './PresenceBadge';
import { RatingStars } from './RatingStars';

type Props = {
  post: PostView;
  onChange: (p: PostView) => void;
  onRemoved?: (id: string) => void;
  /** No detalhe, a legenda não é truncada. */
  detail?: boolean;
};

/**
 * Card de publicação estilo feed de fotos:
 * autor + lugar → fotos (carrossel, toque duplo curte) → ações → curtidas → legenda → selos.
 * Credibilidade fica no perfil (não polui o card); nível aparece discreto.
 */
export function PostCard({ post, onChange, onRemoved, detail }: Props) {
  const actions = usePostActions(post, onChange, onRemoved);
  const [menu, setMenu] = useState<'none' | 'menu' | 'confirmDelete'>('none');
  const [expanded, setExpanded] = useState(!!detail);

  const openPost = () => !detail && router.push({ pathname: '/post/[id]', params: { id: post.id } });
  const place = post.event?.title ?? post.placeName;
  const hasPhotos = post.photos.length > 0;
  const likeOnly = () => !post.likedByMe && actions.toggleLike();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Link href={{ pathname: '/u/[username]', params: { username: post.author.username } }} asChild>
          <Pressable style={styles.author} accessibilityRole="link" accessibilityLabel={`Perfil de ${post.author.displayName}`}>
            <Avatar name={post.author.displayName} url={post.author.avatarUrl} seed={post.author.id} size={36} />
            <View style={styles.authorText}>
              <View style={styles.nameRow}>
                <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>{post.author.username}</Text>
                <LevelBadge level={post.author.level} />
                <DemoTag show={!!post.author.isDemo} />
              </View>
              {place ? (
                <View style={styles.placeRow}>
                  <MapPin size={11} color={colors.accentPink} />
                  <Text variant="mono" tone="secondary" numberOfLines={1} style={styles.shrink}>{place}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </Link>
        <IconButton icon={<MoreHorizontal size={20} color={colors.textSecondary} />} label="Mais opções" onPress={() => setMenu('menu')} />
      </View>

      {hasPhotos ? (
        <PhotoCarousel photos={post.photos} onDoubleTap={likeOnly} onPress={openPost} accessibilityLabel={`Fotos de ${post.author.username}${place ? ` em ${place}` : ''}`} />
      ) : post.body ? (
        // publicação só de texto: o texto ocupa o lugar da foto
        <Pressable onPress={openPost} disabled={detail} style={styles.textBlock}>
          <Text variant="headline" numberOfLines={detail ? undefined : 6} style={styles.textOnly}>{post.body}</Text>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <IconButton
          label={post.likedByMe ? 'Descurtir' : 'Curtir'}
          selected={post.likedByMe}
          pop
          onPress={actions.toggleLike}
          icon={<FomoLikeIcon size={25} active={post.likedByMe} />}
        />
        <IconButton label="Comentários" onPress={openPost} icon={<FomoCommentIcon size={25} />} />
        <IconButton label="Chamar a galera" onPress={actions.share} icon={<FomoShareIcon size={24} />} />
        <View style={styles.flex} />
        <IconButton
          label={post.savedByMe ? 'Tirar do quero ir' : 'Quero ir'}
          selected={post.savedByMe}
          pop
          onPress={actions.toggleSave}
          icon={<FomoSaveIcon size={25} active={post.savedByMe} />}
        />
      </View>

      <View style={styles.body}>
        {post.likesCount > 0 ? (
          <AnimatedCount variant="bodyStrong" value={post.likesCount} format={formatCount} suffix={post.likesCount === 1 ? ' curtida' : ' curtidas'} />
        ) : null}

        {post.body && hasPhotos ? (
          <Pressable onPress={() => (detail ? null : expanded ? openPost() : setExpanded(true))} disabled={detail}>
            <Text numberOfLines={expanded ? undefined : 2}>
              <Text variant="bodyStrong">{post.author.username} </Text>
              {post.body}
            </Text>
            {!expanded && post.body.length > 90 ? <Text tone="muted">mais</Text> : null}
          </Pressable>
        ) : null}

        {post.rating || post.presence !== 'none' || post.visibility !== 'public' ? (
          <View style={styles.tags}>
            {post.rating ? <RatingStars value={post.rating} /> : null}
            <PresenceBadge presence={post.presence} />
            {post.visibility !== 'public' ? (
              <Text variant="mono" tone="muted">{post.visibility === 'followers' ? 'só seguidores' : 'só você'}</Text>
            ) : null}
          </View>
        ) : null}

        {post.commentsCount > 0 && !detail ? (
          <Pressable onPress={openPost}>
            <Text tone="muted">Ver {post.commentsCount === 1 ? 'o comentário' : `os ${post.commentsCount} comentários`}</Text>
          </Pressable>
        ) : null}

        <Text variant="mono" tone="muted">
          {formatRelative(post.createdAt) === 'agora' ? 'agora' : `há ${formatRelative(post.createdAt)}`}
          {post.experienceDate ? ` · rolê de ${formatDay(post.experienceDate)}` : ''}
        </Text>
      </View>

      <ActionSheet
        visible={menu === 'menu'}
        onClose={() => setMenu('none')}
        actions={
          post.isMine
            ? [{ label: 'Excluir publicação', destructive: true, icon: <Trash2 size={18} color={colors.danger} />, onPress: () => setMenu('confirmDelete') }]
            : [{ label: 'Denunciar publicação', destructive: true, icon: <Flag size={18} color={colors.danger} />, onPress: () => actions.report() }]
        }
      />
      <ActionSheet
        visible={menu === 'confirmDelete'}
        onClose={() => setMenu('none')}
        title="Excluir publicação?"
        message="As fotos e a legenda somem para todos. XP ganho com ela é revertido."
        actions={[{ label: 'Excluir', destructive: true, onPress: actions.remove }]}
      />
    </View>
  );
}

export function PostCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.author}>
          <Skeleton width={36} height={36} rounded={radius.pill} />
          <View style={[styles.authorText, { gap: spacing.xs }]}>
            <Skeleton width="40%" />
            <Skeleton width="25%" height={10} />
          </View>
        </View>
      </View>
      <Skeleton height={360} rounded={0} />
      <View style={[styles.body, { paddingVertical: spacing.md }]}>
        <Skeleton width="30%" />
        <Skeleton width="85%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md, paddingRight: spacing.xs, paddingVertical: spacing.sm },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  authorText: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrink: { flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  body: { gap: spacing.xs + 2, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  textBlock: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  textOnly: { lineHeight: 24 },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  flex: { flex: 1 },
});
