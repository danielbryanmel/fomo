import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SendHorizontal } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Avatar, Screen, Skeleton, Text, useToast } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, motion, radius, spacing } from '@/theme';
import type { Message } from '@/types/domain';

const enter = FadeInDown.springify().damping(motion.spring.soft.damping).reduceMotion(ReduceMotion.System);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Conversa 1:1 em tempo real. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const toast = useToast();
  const me = auth.profile?.id ?? 'u-me';
  const peer = useAsync(() => repositories.messages.peer(id), [id]);
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    let alive = true;
    void repositories.messages.list(id).then((m) => alive && setMsgs(m)).catch(() => alive && setMsgs([]));
    void repositories.messages.markRead(id).catch(() => {});
    const off = repositories.messages.subscribe(id, (m) => {
      setMsgs((l) => (l?.some((x) => x.id === m.id) ? l : [...(l ?? []), m]));
      if (m.senderId !== me) void repositories.messages.markRead(id).catch(() => {});
    });
    return () => {
      alive = false;
      off();
    };
  }, [id, me]);

  useEffect(() => {
    if (msgs?.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [msgs?.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    try {
      const m = await repositories.messages.send(id, body);
      setMsgs((l) => (l?.some((x) => x.id === m.id) ? l : [...(l ?? []), m]));
    } catch (e) {
      setText(body);
      toast(e instanceof Error ? e.message : 'Não foi possível enviar.', 'error');
    } finally {
      setSending(false);
    }
  }

  const p = peer.data;
  return (
    <Screen bleed edges={['bottom']}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable onPress={() => p && router.push({ pathname: '/u/[username]', params: { username: p.username } })} style={styles.title} accessibilityRole="link">
              {p ? <Avatar name={p.displayName} url={p.avatarUrl} seed={p.id} size={28} /> : null}
              <Text variant="bodyStrong">{p ? p.username : '…'}</Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {msgs === null ? (
          <View style={styles.list}>{[0, 1, 2].map((i) => <Skeleton key={i} height={40} width={i % 2 ? '60%' : '45%'} />)}</View>
        ) : (
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text tone="muted" align="center">Diga oi e combine o rolê.</Text>}
            renderItem={({ item, index }) => {
              const mine = item.senderId === me;
              const prev = msgs[index - 1];
              const grouped = prev && prev.senderId === item.senderId && Date.parse(item.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
              return (
                <Animated.View entering={index >= msgs.length - 3 ? enter : undefined} style={[styles.bubbleRow, mine ? styles.right : styles.left, !grouped && { marginTop: spacing.sm }]}>
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <Text style={mine ? styles.mineText : undefined}>{item.body}</Text>
                    <Text variant="mono" style={[styles.time, mine && styles.timeMine]}>{hhmm(item.createdAt)}</Text>
                  </View>
                </Animated.View>
              );
            }}
          />
        )}
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Mensagem"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={2000}
            onSubmitEditing={send}
            blurOnSubmit={false}
            accessibilityLabel="Escrever mensagem"
          />
          <Pressable onPress={send} disabled={!text.trim() || sending} style={[styles.send, (!text.trim() || sending) && styles.sendOff]} accessibilityRole="button" accessibilityLabel="Enviar">
            <SendHorizontal size={20} color={colors.text} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { padding: spacing.lg, gap: 3, flexGrow: 1, justifyContent: 'flex-end' },
  bubbleRow: { flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, gap: 2 },
  mine: { backgroundColor: colors.accentPink, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surfaceRaised, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.border },
  mineText: { color: colors.text },
  time: { fontSize: 10, color: colors.textMuted, alignSelf: 'flex-end' },
  timeMine: { color: 'rgba(255,255,255,0.75)' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { outlineStyle: 'none' as never, flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPink },
  sendOff: { opacity: 0.4 },
});
