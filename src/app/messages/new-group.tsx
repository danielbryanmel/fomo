import { router, Stack } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Field } from '@/components/form/Field';
import { FriendPicker } from '@/components/group/FriendPicker';
import { Avatar, Button, Screen, Text, useToast } from '@/components/ui';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { UserProfile } from '@/types/domain';

/** Novo grupo no direct: nome + quem entra (gente que você segue ou que te segue). */
export default function NewGroupChatScreen() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (p: UserProfile) => setPicked((l) => (l.some((x) => x.id === p.id) ? l.filter((x) => x.id !== p.id) : [...l, p].slice(0, 30)));

  async function create() {
    setBusy(true);
    try {
      const id = await repositories.messages.createGroup(title, picked.map((p) => p.id));
      router.replace({ pathname: '/messages/[id]', params: { id } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível criar o grupo.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bleed edges={['bottom']}>
      <Stack.Screen options={{ title: 'Novo grupo' }} />
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Field label="nome do grupo" value={title} onChangeText={setTitle} max={60} placeholder="Ex.: Rolê de sexta" />
        {picked.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {picked.map((p) => (
              <Pressable key={p.id} onPress={() => toggle(p)} style={styles.chip} accessibilityRole="button" accessibilityLabel={`Tirar ${p.displayName}`}>
                <Avatar name={p.displayName} url={p.avatarUrl} seed={p.id} size={24} />
                <Text variant="caption" numberOfLines={1}>{p.username}</Text>
                <X size={14} color={colors.textMuted} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Text variant="mono" tone="muted">quem entra · {picked.length}/30</Text>
        <Text variant="caption" tone="muted">Dá para colocar quem você segue ou quem te segue.</Text>
        <FriendPicker selected={picked.map((p) => p.id)} onToggle={toggle} />
      </ScrollView>
      <View style={styles.footer}>
        <Button label={picked.length ? `Criar grupo com ${picked.length}` : 'Criar grupo'} disabled={!title.trim() || !picked.length}
          loading={busy} onPress={create} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  chips: { gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: spacing.sm, height: 34, borderRadius: radius.pill, backgroundColor: colors.surface },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
