import { router } from 'expo-router';
import { UserPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Appear, PressableScale } from '@/components/motion';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { PersonSuggestion } from '@/types/domain';

/** Botão seguir que vira "Seguindo"/"Pedido enviado" na hora. */
export function FollowButton({ userId, onDone }: { userId: string; onDone?: (status: 'pending' | 'accepted' | null) => void }) {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'busy' | 'pending' | 'accepted'>('idle');
  async function follow() {
    setState('busy');
    try {
      const s = await repositories.profiles.toggleFollow(userId);
      setState(s ?? 'idle');
      onDone?.(s);
    } catch (e) {
      setState('idle');
      toast(e instanceof Error ? e.message : 'Não foi possível seguir.', 'error');
    }
  }
  if (state === 'accepted') return <Button label="Seguindo" variant="secondary" disabled onPress={() => {}} />;
  if (state === 'pending') return <Button label="Pedido enviado" variant="secondary" disabled onPress={() => {}} />;
  return <Button label="Seguir" icon={<UserPlus size={15} color={colors.text} />} loading={state === 'busy'} onPress={follow} />;
}

/** Faixa horizontal "Pessoas que você talvez conheça" (feed). Some se não houver sugestões. */
export function SuggestionsStrip() {
  const list = useAsync(() => repositories.profiles.suggestions(12).catch(() => [] as PersonSuggestion[]), []);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const items = (list.data ?? []).filter((s) => !hidden.has(s.profile.id));
  if (!items.length) return null;
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text variant="mono" tone="muted" style={styles.flex}>pessoas que você talvez conheça</Text>
        <Pressable onPress={() => router.push('/people')} hitSlop={8} accessibilityRole="link"><Text variant="mono" tone="primary">ver todas</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.wrap}>
        {items.map((s, i) => (
          <Appear key={s.profile.id} index={i}>
            <View style={styles.card}>
              <Pressable style={styles.dismiss} onPress={() => setHidden((h) => new Set(h).add(s.profile.id))} accessibilityRole="button" accessibilityLabel={`Dispensar ${s.profile.displayName}`} hitSlop={8}>
                <X size={14} color={colors.textMuted} />
              </Pressable>
              <PressableScale style={styles.who} onPress={() => router.push({ pathname: '/u/[username]', params: { username: s.profile.username } })} accessibilityRole="link">
                <Avatar name={s.profile.displayName} url={s.profile.avatarUrl} seed={s.profile.id} size={64} />
                <Text variant="bodyStrong" numberOfLines={1}>{s.profile.displayName}</Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>{s.reason}</Text>
              </PressableScale>
              <FollowButton userId={s.profile.id} />
            </View>
          </Appear>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  wrap: { marginHorizontal: -spacing.lg },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: { width: 156, alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  who: { alignItems: 'center', gap: 4, alignSelf: 'stretch' },
  dismiss: { position: 'absolute', top: 8, right: 8, zIndex: 2, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
