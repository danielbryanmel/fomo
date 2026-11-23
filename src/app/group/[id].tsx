import { router, Stack, useLocalSearchParams } from 'expo-router';
import { MapPinned, UserPlus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FriendPicker } from '@/components/group/FriendPicker';
import { RespondButtons, STATUS_LABEL, whenLabel } from '@/components/group/GroupCard';
import { Appear } from '@/components/motion';
import { PersonRow } from '@/components/profile/PersonRow';
import { ActionSheet, Button, Screen, Skeleton, StateView, Text, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { GroupStatus } from '@/types/domain';

const ORDER: GroupStatus[] = ['going', 'maybe', 'invited', 'declined'];
const SECTION: Record<GroupStatus, string> = { going: 'confirmados', maybe: 'talvez', invited: 'convites pendentes', declined: 'não vão' };

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const group = useAsync(() => repositories.groups.get(id), [id]);
  const [inviting, setInviting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [leave, setLeave] = useState(false);

  if (group.loading && !group.data) return <Screen><View style={styles.pad}><Skeleton height={140} /><Skeleton height={60} /></View></Screen>;
  if (!group.data) return <Screen><StateView icon={<Users size={26} color={colors.textSecondary} />} title="Grupo indisponível" description="Você não faz parte dele, ou ele foi apagado." /></Screen>;
  const g = group.data;

  async function sendInvites() {
    try {
      const n = await repositories.groups.invite(g.id, picked);
      toast(n ? `${n} convite${n > 1 ? 's' : ''} enviado${n > 1 ? 's' : ''}` : 'Essas pessoas já estavam no grupo', 'success');
      setPicked([]);
      setInviting(false);
      await group.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível convidar.', 'error');
    }
  }

  return (
    <Screen bleed edges={['bottom']}>
      <Stack.Screen options={{ title: g.name }} />
      <ScrollView contentContainerStyle={styles.pad}>
        <Appear>
          <View style={styles.hero}>
            <Text variant="mono" tone="muted">{whenLabel(g.event.startsAt)}</Text>
            <Text variant="display">{g.name}</Text>
            <Text variant="mono" tone="secondary">{g.event.title}{g.event.venueName ? ` · ${g.event.venueName}` : ''}</Text>
            <Text variant="headline" style={styles.big}>{g.counts.going} {g.counts.going === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}</Text>
            <RespondButtons group={g} onChange={(x) => group.setData(() => x)} />
            <View style={styles.actions}>
              <Button label="Ver rolê" variant="secondary" icon={<MapPinned size={16} color={colors.text} />} onPress={() => router.push({ pathname: '/event/[id]', params: { id: g.event.id } })} />
              {g.myStatus === 'going' ? (
                <Button label="Chamar mais gente" variant="secondary" icon={<UserPlus size={16} color={colors.text} />} onPress={() => setInviting((v) => !v)} />
              ) : null}
            </View>
          </View>
        </Appear>

        {inviting ? (
          <View style={styles.section}>
            <FriendPicker selected={picked} exclude={g.members.map((m) => m.profile.id)} onToggle={(p) => setPicked((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} />
            <Button label={`Convidar ${picked.length || ''}`.trim()} disabled={!picked.length} onPress={sendInvites} fullWidth />
          </View>
        ) : null}

        {ORDER.map((st) => {
          const ms = g.members.filter((m) => m.status === st);
          if (!ms.length) return null;
          return (
            <View key={st} style={styles.section}>
              <Text variant="mono" tone="muted">{SECTION[st]} · {ms.length}</Text>
              {ms.map((m, i) => (
                <Appear key={m.profile.id} index={i}>
                  <PersonRow person={m.profile} subtitle={m.profile.id === g.ownerId ? 'criou o grupo' : STATUS_LABEL[st].toLowerCase()} />
                </Appear>
              ))}
            </View>
          );
        })}

        <Button label="Sair do grupo" variant="ghost" onPress={() => setLeave(true)} />
      </ScrollView>
      <ActionSheet
        visible={leave}
        onClose={() => setLeave(false)}
        title="Sair do grupo?"
        actions={[{ label: 'Sair', destructive: true, onPress: async () => {
          try {
            await repositories.groups.leave(g.id);
            router.canGoBack() ? router.back() : router.replace('/saved');
          } catch {
            toast('Não foi possível sair agora.', 'error');
          }
        } }]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },
  hero: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  big: { marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  section: { gap: spacing.xs },
});
