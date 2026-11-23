import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CornerDownRight, LogOut, SendHorizontal, UserPlus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FriendPicker } from '@/components/group/FriendPicker';
import { GroupAvatar } from '@/components/messages/GroupAvatar';
import { PersonRow } from '@/components/profile/PersonRow';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { ActionSheet, Avatar, Button, Screen, Skeleton, Text, useToast } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, motion, radius, spacing } from '@/theme';
import type { Message } from '@/types/domain';

const enter = FadeInDown.springify().damping(motion.spring.soft.damping).reduceMotion(ReduceMotion.System);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Conversa em tempo real — 1:1 ou em grupo. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const toast = useToast();
  const me = auth.profile?.id ?? 'u-me';
  const info = useAsync(() => repositories.messages.info(id), [id]);
  const [panel, setPanel] = useState<'members' | 'add' | null>(null);
  const [adding, setAdding] = useState<string[]>([]);
  const [leaving, setLeaving] = useState(false);
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

  const conv = info.data;
  const isGroup = !!conv?.isGroup;
  const p = conv && !isGroup ? (conv.members.find((m) => m.id !== me) ?? null) : null;
  const others = conv?.members.filter((m) => m.id !== me) ?? [];
  const byId = new Map((conv?.members ?? []).map((m) => [m.id, m]));

  async function addPeople() {
    try {
      const n = await repositories.messages.addMembers(id, adding);
      toast(n ? `${n} ${n === 1 ? 'pessoa entrou' : 'pessoas entraram'} no grupo` : 'Ninguém novo: só entra quem você segue ou te segue', n ? 'success' : 'neutral');
      setAdding([]);
      setPanel(null);
      await info.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível adicionar.', 'error');
    }
  }

  async function leave() {
    try {
      await repositories.messages.leave(id);
      toast('Você saiu do grupo', 'neutral');
      router.replace('/messages');
    } catch {
      toast('Não foi possível sair agora.', 'error');
    }
  }

  return (
    <Screen bleed edges={['bottom']}>
      <Stack.Screen
        options={{
          headerTitle: () =>
            isGroup ? (
              <Pressable onPress={() => setPanel('members')} style={styles.title} accessibilityRole="button" accessibilityLabel={`Grupo ${conv?.title ?? ''}, ver pessoas`}>
                <GroupAvatar members={others} size={30} />
                <View>
                  <Text variant="bodyStrong" numberOfLines={1}>{conv?.title ?? 'Grupo'}</Text>
                  <Text variant="caption" tone="muted">{conv?.members.length ?? 0} pessoas · ver</Text>
                </View>
              </Pressable>
            ) : (
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
              const sender = byId.get(item.senderId);
              const showName = isGroup && !mine && !grouped;
              return (
                <Animated.View entering={index >= msgs.length - 3 ? enter : undefined} style={[styles.bubbleRow, mine ? styles.right : styles.left, !grouped && { marginTop: spacing.sm }]}>
                  {isGroup && !mine ? (
                    <View style={styles.avatarSlot}>{!grouped && sender ? <Avatar name={sender.displayName} url={sender.avatarUrl} seed={sender.id} size={26} /> : null}</View>
                  ) : null}
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    {showName ? <Text variant="caption" tone="accent">{sender?.username ?? 'alguém'}</Text> : null}
                    {item.replyLabel ? (
                      <View style={styles.reply}>
                        <CornerDownRight size={12} color={mine ? 'rgba(255,255,255,0.8)' : colors.textMuted} />
                        <Text variant="caption" numberOfLines={1} style={mine ? styles.timeMine : styles.replyText}>{item.replyLabel}</Text>
                      </View>
                    ) : null}
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

      <Modal visible={panel !== null} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPanel(null)} accessibilityLabel="Fechar" />
        <View style={styles.sheet}>
          {panel === 'add' ? (
            <>
              <Text variant="headline">Adicionar pessoas</Text>
              <View style={styles.sheetList}>
                <FriendPicker selected={adding} exclude={conv?.members.map((m) => m.id) ?? []}
                  onToggle={(x) => setAdding((l) => (l.includes(x.id) ? l.filter((i) => i !== x.id) : [...l, x.id]))} />
              </View>
              <Button label={adding.length ? `Adicionar ${adding.length}` : 'Adicionar'} disabled={!adding.length} onPress={addPeople} fullWidth />
            </>
          ) : (
            <>
              <Text variant="headline">{conv?.title ?? 'Grupo'}</Text>
              <FlatList style={styles.sheetList} data={conv?.members ?? []} keyExtractor={(m) => m.id}
                renderItem={({ item }) => <PersonRow person={item} subtitle={item.id === me ? 'você' : undefined} />} />
              <Button label="Adicionar pessoas" variant="secondary" icon={<UserPlus size={16} color={colors.text} />} onPress={() => setPanel('add')} fullWidth />
              <Button label="Sair do grupo" variant="ghost" icon={<LogOut size={16} color={colors.danger} />} onPress={() => { setPanel(null); setLeaving(true); }} fullWidth />
            </>
          )}
        </View>
      </Modal>
      <ActionSheet visible={leaving} onClose={() => setLeaving(false)} title="Sair deste grupo?"
        actions={[{ label: 'Sair', destructive: true, onPress: leave }]} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { padding: spacing.lg, gap: 3, flexGrow: 1, justifyContent: 'flex-end' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  avatarSlot: { width: 26 },
  reply: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 2, maxWidth: 240 },
  replyText: { color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '75%', padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface },
  sheetList: { maxHeight: 380 },
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
