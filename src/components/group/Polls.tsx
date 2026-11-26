import { Plus, Vote, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { Field } from '@/components/form/Field';
import { PressableScale } from '@/components/motion/PressableScale';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { repositories } from '@/repositories';
import { colors, motion, radius, spacing } from '@/theme';
import type { GroupPoll } from '@/types/domain';

const grow = LinearTransition.springify().damping(motion.spring.soft.damping).reduceMotion(ReduceMotion.System);

/** Barra de resultado que cresce com mola quando o voto muda. */
function Bar({ pct, mine }: { pct: number; mine: boolean }) {
  return <Animated.View layout={grow} style={[styles.bar, mine && styles.barMine, { width: `${pct}%` }]} />;
}

function PollCard({ poll, onVoted }: { poll: GroupPoll; onVoted: () => void }) {
  const toast = useToast();
  const [local, setLocal] = useState<{ votes: number[]; myVote: number | null }>({ votes: poll.votes, myVote: poll.myVote });
  const total = local.votes.reduce((a, b) => a + b, 0);
  const leader = Math.max(...local.votes);

  async function vote(i: number) {
    if (local.myVote === i) return;
    const prev = local;
    // otimista: tira o voto antigo, põe o novo
    const votes = [...local.votes];
    if (local.myVote !== null) votes[local.myVote] = (votes[local.myVote] ?? 1) - 1;
    votes[i] = (votes[i] ?? 0) + 1;
    setLocal({ votes, myVote: i });
    try {
      await repositories.groups.vote(poll.id, i);
      onVoted();
    } catch (e) {
      setLocal(prev);
      toast(e instanceof Error ? e.message : 'Não foi possível votar.', 'error');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Vote size={16} color={colors.accentPink} />
        <Text variant="bodyStrong" style={styles.flex}>{poll.question}</Text>
      </View>
      {poll.options.map((o, i) => {
        const n = local.votes[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const mine = local.myVote === i;
        return (
          <PressableScale key={i} onPress={() => vote(i)} scaleTo={0.98} style={[styles.opt, mine && styles.optMine]}
            accessibilityRole="button" accessibilityState={{ selected: mine }} accessibilityLabel={`${o}, ${n} votos`}>
            <Bar pct={pct} mine={mine} />
            <Text variant="body" style={[styles.flex, n === leader && total > 0 && styles.lead]} numberOfLines={1}>{o}</Text>
            <Text variant="mono" tone={mine ? 'primary' : 'muted'}>{total ? `${pct}%` : ''}</Text>
          </PressableScale>
        );
      })}
      <Text variant="mono" tone="muted">{total} {total === 1 ? 'voto' : 'votos'}{local.myVote === null ? ' · toque para votar' : ' · dá para trocar'}</Text>
    </View>
  );
}

function NewPoll({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const valid = q.trim().length >= 2 && opts.filter((o) => o.trim()).length >= 2;

  async function create() {
    setBusy(true);
    try {
      await repositories.groups.createPoll(groupId, q, opts);
      toast('Enquete criada. O grupo foi avisado.', 'success');
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível criar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Field label="pergunta" value={q} onChangeText={setQ} max={120} placeholder="Onde a gente esquenta?" />
      {opts.map((o, i) => (
        <View key={i} style={styles.optRow}>
          <View style={styles.flex}>
            <Field label={`opção ${i + 1}`} value={o} max={60} onChangeText={(t) => setOpts((s) => s.map((x, k) => (k === i ? t : x)))} />
          </View>
          {opts.length > 2 ? (
            <PressableScale onPress={() => setOpts((s) => s.filter((_, k) => k !== i))} accessibilityLabel={`Remover opção ${i + 1}`} style={styles.remove}>
              <X size={16} color={colors.textSecondary} />
            </PressableScale>
          ) : null}
        </View>
      ))}
      {opts.length < 4 ? (
        <Button label="Adicionar opção" variant="ghost" icon={<Plus size={16} color={colors.text} />} onPress={() => setOpts((s) => [...s, ''])} />
      ) : null}
      <Button label="Criar enquete" disabled={!valid} loading={busy} onPress={create} fullWidth />
    </View>
  );
}

/** Enquetes do grupo: votar (1 voto por pessoa, dá para trocar) e criar novas. */
export function Polls({ groupId, polls, canCreate, onChange }: { groupId: string; polls: GroupPoll[]; canCreate: boolean; onChange: () => void }) {
  const [creating, setCreating] = useState(false);
  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <Text variant="mono" tone="muted" style={styles.flex}>enquetes{polls.length ? ` · ${polls.length}` : ''}</Text>
        {canCreate ? (
          <Button label={creating ? 'Cancelar' : 'Nova enquete'} variant="ghost" onPress={() => setCreating((v) => !v)} />
        ) : null}
      </View>
      {creating ? <NewPoll groupId={groupId} onDone={() => { setCreating(false); onChange(); }} /> : null}
      {polls.map((p) => <PollCard key={p.id} poll={p} onVoted={onChange} />)}
      {!polls.length && !creating ? (
        <Text variant="caption" tone="muted">{canCreate ? 'Em dúvida entre dois lugares ou horários? Abra uma enquete.' : 'Nenhuma enquete ainda.'}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  optMine: { borderColor: colors.accentPink },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.06)' },
  barMine: { backgroundColor: 'rgba(224,51,143,0.22)' },
  lead: { fontWeight: '700' },
  optRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  remove: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
});
