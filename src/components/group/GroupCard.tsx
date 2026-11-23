import { router } from 'expo-router';
import { Check, CircleHelp, X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { GroupStatus, GroupView } from '@/types/domain';

export const STATUS_LABEL: Record<GroupStatus, string> = { going: 'Vou', maybe: 'Talvez', declined: 'Não vou', invited: 'Convidado' };

export function whenLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000);
  const day = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  return `${day}, ${d.getHours()}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, '0') : ''}`;
}

/** Respostas ao convite: aceitar / talvez / recusar. */
export function RespondButtons({ group, onChange }: { group: GroupView; onChange: (g: GroupView) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<GroupStatus | null>(null);
  async function respond(s: Exclude<GroupStatus, 'invited'>) {
    setBusy(s);
    try {
      await repositories.groups.respond(group.id, s);
      const fresh = await repositories.groups.get(group.id);
      if (fresh) onChange(fresh);
      toast(s === 'going' ? 'Confirmado! Bom rolê' : s === 'maybe' ? 'Marcado como talvez' : 'Convite recusado', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível responder.', 'error');
    } finally {
      setBusy(null);
    }
  }
  const btn = (s: Exclude<GroupStatus, 'invited'>, label: string, icon: ReactNode) => (
    <View style={styles.flex}>
      <Button label={label} variant={group.myStatus === s ? 'primary' : 'secondary'} icon={icon} loading={busy === s} fullWidth onPress={() => respond(s)} />
    </View>
  );
  return (
    <View style={styles.row}>
      {btn('going', 'Aceitar', <Check size={16} color={colors.text} />)}
      {btn('maybe', 'Talvez', <CircleHelp size={16} color={colors.text} />)}
      {btn('declined', 'Recusar', <X size={16} color={colors.text} />)}
    </View>
  );
}

/** Card do grupo: nome, rolê, quando, confirmados (com rostos) e respostas. */
export function GroupCard({ group, onChange }: { group: GroupView; onChange: (g: GroupView) => void }) {
  const going = group.members.filter((m) => m.status === 'going');
  return (
    <View style={styles.card}>
      <PressableScale onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })} scaleTo={0.98} style={styles.top} accessibilityRole="link">
        <Text variant="title">{group.name}</Text>
        <Text variant="mono" tone="secondary">{group.event.title}{group.event.venueName ? ` · ${group.event.venueName}` : ''}</Text>
        <Text variant="mono" tone="muted">{whenLabel(group.event.startsAt)}</Text>
        <View style={styles.faces}>
          {going.slice(0, 5).map((m, i) => (
            <View key={m.profile.id} style={[styles.face, { marginLeft: i ? -10 : 0 }]}>
              <Avatar name={m.profile.displayName} url={m.profile.avatarUrl} seed={m.profile.id} size={28} />
            </View>
          ))}
          <Text variant="bodyStrong" style={styles.count}>{group.counts.going} {group.counts.going === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}</Text>
        </View>
        {group.counts.maybe || group.counts.invited ? (
          <Text variant="caption" tone="muted">
            {[group.counts.maybe ? `${group.counts.maybe} talvez` : '', group.counts.invited ? `${group.counts.invited} sem resposta` : ''].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </PressableScale>
      <RespondButtons group={group} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  top: { gap: 4 },
  faces: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  face: { borderRadius: 16, borderWidth: 2, borderColor: colors.surface },
  count: { marginLeft: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
