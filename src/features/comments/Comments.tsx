import { Link } from 'expo-router';
import { FomoCommentIcon } from '@/components/icons/FomoIcons';
import { SendHorizontal, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { PressableScale } from '@/components/motion';
import { Avatar, Text, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/lib/format';
import { repositories } from '@/repositories';
import { colors, hitTarget, motion, radius, spacing } from '@/theme';
import type { CommentView } from '@/types/domain';

const MAX = 500;
const enter = FadeInDown.springify().damping(motion.spring.soft.damping).reduceMotion(ReduceMotion.System);
const exit = FadeOut.duration(motion.fast).reduceMotion(ReduceMotion.System);
const layout = LinearTransition.springify().damping(motion.spring.soft.damping).reduceMotion(ReduceMotion.System);

type Props = { postId: string; onCountChange?: (delta: number) => void };

/** Lista + campo de comentário. Quem pode ver/comentar/apagar é decidido pela RLS. */
export function Comments({ postId, onCountChange }: Props) {
  const toast = useToast();
  const list = useAsync(() => repositories.social.listComments(postId), [postId]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const c = await repositories.social.addComment(postId, body);
      list.setData((prev) => [...(prev ?? []), c]);
      setText('');
      onCountChange?.(1);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível comentar.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function remove(c: CommentView) {
    list.setData((prev) => prev?.filter((x) => x.id !== c.id));
    onCountChange?.(-1);
    try {
      await repositories.social.deleteComment(c.id);
    } catch (e) {
      list.setData((prev) => [...(prev ?? []), c].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      onCountChange?.(1);
      toast(e instanceof Error ? e.message : 'Não foi possível apagar.', 'error');
    }
  }

  const items = list.data ?? [];

  return (
    <View style={styles.root}>
      <Text variant="mono" tone="muted">comentários{items.length ? ` · ${items.length}` : ''}</Text>

      {list.loading ? <ActivityIndicator color={colors.textMuted} style={styles.pad} /> : null}
      {list.error ? (
        <Pressable onPress={list.refresh} style={styles.pad}><Text tone="danger" align="center">Não carregou. Toque para tentar de novo.</Text></Pressable>
      ) : null}
      {!list.loading && !list.error && !items.length ? (
        <View style={[styles.empty, styles.pad]}>
          <FomoCommentIcon size={24} color={colors.textMuted} />
          <Text tone="muted" align="center">Ninguém comentou ainda. Conta como foi.</Text>
        </View>
      ) : null}

      {items.map((c) => (
        <Animated.View key={c.id} entering={enter} exiting={exit} layout={layout} style={styles.row}>
          <Link href={{ pathname: '/u/[username]', params: { username: c.author.username } }} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={`Perfil de ${c.author.displayName}`}>
              <Avatar name={c.author.displayName} url={c.author.avatarUrl} seed={c.author.id} size={32} />
            </Pressable>
          </Link>
          <View style={styles.bubble}>
            <Text>
              <Text variant="bodyStrong">{c.author.username} </Text>
              {c.body}
            </Text>
            <Text variant="mono" tone="muted">{formatRelative(c.createdAt) === 'agora' ? 'agora' : `há ${formatRelative(c.createdAt)}`}</Text>
          </View>
          {c.canDelete ? (
            <Pressable onPress={() => remove(c)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Apagar comentário" style={styles.del}>
              <Trash2 size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Animated.View>
      ))}

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={(t) => setText(t.slice(0, MAX))}
          placeholder="Adicione um comentário…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          maxLength={MAX}
          accessibilityLabel="Escrever comentário"
          onSubmitEditing={send}
          submitBehavior="submit"
        />
        <PressableScale
          onPress={send}
          disabled={!text.trim() || sending}
          scaleTo={0.88}
          accessibilityRole="button"
          accessibilityLabel="Enviar comentário"
          style={[styles.send, (!text.trim() || sending) && styles.sendOff]}
        >
          {sending ? <ActivityIndicator size="small" color={colors.text} /> : <SendHorizontal size={18} color={colors.text} />}
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  pad: { paddingVertical: spacing.lg },
  empty: { alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm + 2, alignItems: 'flex-start' },
  bubble: { flex: 1, gap: 2 },
  del: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  input: {
    flex: 1, minHeight: hitTarget, maxHeight: 120, color: colors.text, fontSize: 15,
    paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 12,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  send: { width: hitTarget, height: hitTarget, borderRadius: hitTarget / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPink },
  sendOff: { opacity: 0.35 },
});
