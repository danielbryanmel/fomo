import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '@/components/form/Field';
import { FriendPicker } from '@/components/group/FriendPicker';
import { whenLabel } from '@/components/group/GroupCard';
import { Button, Screen, StateView, Text, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';

/** Criar grupo para um rolê e chamar a galera. */
export default function NewGroupScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const event = useAsync(() => repositories.events.getById(eventId), [eventId]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!event.loading && !event.data) return <Screen><StateView title="Rolê não encontrado" /></Screen>;
  const e = event.data;
  const fallback = e ? `${e.title.split(' ').slice(0, 3).join(' ')} com a galera` : '';

  async function create() {
    if (!e) return;
    setBusy(true);
    try {
      const id = await repositories.groups.create(e.id, (name.trim() || fallback).slice(0, 60), selected);
      toast(selected.length ? `Grupo criado · ${selected.length} convite${selected.length > 1 ? 's' : ''} enviado${selected.length > 1 ? 's' : ''}` : 'Grupo criado', 'success');
      router.replace({ pathname: '/group/[id]', params: { id } });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível criar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bleed edges={[]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]} keyboardShouldPersistTaps="handled">
        {e ? (
          <View style={styles.event}>
            <Text variant="mono" tone="muted">rolê</Text>
            <Text variant="title">{e.title}</Text>
            <Text variant="mono" tone="secondary">{whenLabel(e.startsAt)}{e.venueName ? ` · ${e.venueName}` : ''}</Text>
          </View>
        ) : null}
        <Field label="nome do grupo" value={name} onChangeText={setName} max={60} placeholder={fallback || 'Ex.: Sextou em Pinheiros'} />
        <Text variant="mono" tone="muted">chamar quem · {selected.length} selecionado{selected.length === 1 ? '' : 's'}</Text>
        <FriendPicker selected={selected} onToggle={(p) => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : s.length >= 30 ? s : [...s, p.id]))} />
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label={selected.length ? `Criar e convidar ${selected.length}` : 'Criar grupo'} fullWidth loading={busy} disabled={!e} onPress={create} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  event: { gap: 4, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: 'rgba(10,10,11,0.94)' },
});
