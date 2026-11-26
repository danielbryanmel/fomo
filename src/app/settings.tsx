import { router } from 'expo-router';
import { Bug, Camera, ChevronRight, EyeOff, Lock, LogOut, MapPinned, ShieldCheck } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Field } from '@/components/form/Field';
import { ToggleRow } from '@/components/form/ToggleRow';
import { Appear, PressableScale } from '@/components/motion';
import { ActionSheet, Avatar, Button, StateView, Text, useToast } from '@/components/ui';
import { OptionGrid } from '@/components/ui/OptionGrid';
import { useAuth } from '@/features/auth/AuthProvider';
import { pickAvatar } from '@/features/compose/photos';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { CheckinVisibility, ProfileSettings } from '@/types/domain';

const VIS: { key: CheckinVisibility; label: string }[] = [
  { key: 'public', label: 'Todos' },
  { key: 'friends', label: 'Amigos' },
  { key: 'private', label: 'Anônimo' },
];

/** Editar perfil + privacidade + atalhos (sugerir rolê, moderação, sair). */
export default function SettingsScreen() {
  const toast = useToast();
  const auth = useAuth();
  const current = useAsync(() => repositories.profiles.settings(), []);
  const me = useAsync(() => repositories.profiles.me(), []);
  const [form, setForm] = useState<ProfileSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    if (current.data && !form) setForm(current.data);
  }, [current.data, form]);

  if (current.loading || !form) {
    return current.error
      ? <StateView tone="error" title="Não foi possível carregar" actionLabel="Tentar de novo" onAction={current.refresh} />
      : <View style={styles.center}><ActivityIndicator color={colors.accentPink} /></View>;
  }

  const set = <K extends keyof ProfileSettings>(k: K, v: ProfileSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const dirty = JSON.stringify(form) !== JSON.stringify(current.data);
  const nameError = form.displayName.trim().length === 0 ? 'Seu nome não pode ficar vazio.' : null;

  async function changeAvatar() {
    try {
      const photo = await pickAvatar();
      if (!photo) return;
      setUploading(true);
      const url = await repositories.profiles.uploadAvatar(photo);
      set('avatarUrl', url);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível enviar a foto.', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form || nameError) return;
    setSaving(true);
    try {
      const { isModerator: _m, ...patch } = form;
      const saved = await repositories.profiles.updateSettings(patch);
      current.setData(() => saved);
      setForm(saved);
      toast('Perfil atualizado', 'success');
      if (router.canGoBack()) router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const username = me.data?.profile.username;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Appear style={styles.avatarWrap}>
          <PressableScale onPress={changeAvatar} accessibilityRole="button" accessibilityLabel="Trocar foto de perfil" scaleTo={0.94}>
            <Avatar name={form.displayName || '?'} url={form.avatarUrl} seed={username} size={96} />
            <View style={styles.camera}>{uploading ? <ActivityIndicator size="small" color={colors.text} /> : <Camera size={16} color={colors.text} />}</View>
          </PressableScale>
          {username ? (
            <UsernameChanger
              username={username}
              left={form.usernameChangesLeft}
              onChanged={async () => {
                await Promise.all([me.refresh(), current.refresh(), auth.refreshProfile()]);
                setForm((f) => (f ? { ...f, usernameChangesLeft: 0 } : f));
              }}
            />
          ) : null}
        </Appear>

        <Appear index={1} style={styles.group}>
          <Field label="nome" value={form.displayName} onChangeText={(t) => set('displayName', t)} max={50} error={nameError} autoCapitalize="words" />
          <Field label="bio" value={form.bio ?? ''} onChangeText={(t) => set('bio', t)} max={280} multiline placeholder="Que tipo de rolê é a sua cara?" />
          <Field label="cidade" value={form.city ?? ''} onChangeText={(t) => set('city', t)} max={60} placeholder="Ex.: São Paulo" />
        </Appear>

        <Appear index={2} style={styles.group}>
          <Text variant="mono" tone="muted">privacidade</Text>
          <ToggleRow
            icon={<Lock size={18} color={colors.textSecondary} />}
            label="Perfil privado"
            description={form.isPrivate
              ? 'Só seguidores aprovados veem suas publicações e rolês. Seu nome, @ e nível continuam encontráveis.'
              : 'Qualquer pessoa vê suas publicações públicas. Ao ficar público, pedidos pendentes são aprovados.'}
            value={form.isPrivate}
            onChange={(v) => set('isPrivate', v)}
          />
          <ToggleRow
            icon={<EyeOff size={18} color={colors.textSecondary} />}
            label="Modo discreto"
            description={form.discreetMode
              ? 'Ligado: todo check-in é anônimo, stories não marcam o rolê e você para de compartilhar localização com grupos. Vale também para o que você fez nas últimas 24 h.'
              : 'Um toque para sumir: todo check-in vira anônimo (ainda conta no rolê) e stories não mostram onde você está.'}
            value={form.discreetMode}
            onChange={async (v) => {
              try {
                await repositories.profiles.setDiscreetMode(v);
                const next = { ...form, discreetMode: v, defaultCheckinVisibility: v ? 'private' as const : form.defaultCheckinVisibility };
                setForm(next);
                current.setData((c) => (c ? { ...c, discreetMode: v, defaultCheckinVisibility: next.defaultCheckinVisibility } : c));
                toast(v ? 'Modo discreto ligado' : 'Modo discreto desligado', 'success');
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Não foi possível mudar agora.', 'error');
              }
            }}
          />
          <View style={styles.card}>
            <OptionGrid label="quem vê seu check-in (padrão) · anônimo ainda conta no rolê" options={VIS} value={form.defaultCheckinVisibility} onChange={(v) => set('defaultCheckinVisibility', v)} />
            <Text variant="caption" tone="muted">Sua localização em tempo real só aparece quando você liga o compartilhamento com um grupo, e some sozinha no fim. Isto vale para check-ins novos.</Text>
          </View>
        </Appear>

        <Appear index={3} style={styles.group}>
          <Text variant="mono" tone="muted">rolês</Text>
          <LinkRow icon={<MapPinned size={18} color={colors.textSecondary} />} label="Sugerir um rolê" hint="Entra no mapa depois da moderação" onPress={() => router.push('/suggest')} />
          {form.isModerator ? (
            <LinkRow icon={<ShieldCheck size={18} color={colors.live} />} label="Fila de moderação" hint="Aprovar ou recusar sugestões" onPress={() => router.push('/moderation')} />
          ) : null}
        </Appear>

        {auth.status === 'ready' ? (
          <Appear index={4}>
            <Button label="Reportar um problema" variant="secondary" icon={<Bug size={18} color={colors.text} />} onPress={() => router.push('/feedback')} />
            <Button label="Sair da conta" variant="danger" icon={<LogOut size={18} color={colors.danger} />} onPress={() => setConfirmOut(true)} />
          </Appear>
        ) : (
          <Text variant="caption" tone="muted" align="center">Modo demonstração: alterações ficam só neste aparelho até recarregar.</Text>
        )}
      </ScrollView>

      <View style={styles.bar}>
        <Button label="Salvar" fullWidth loading={saving} disabled={!dirty || !!nameError || uploading} onPress={save} />
      </View>

      <ActionSheet
        visible={confirmOut}
        onClose={() => setConfirmOut(false)}
        title="Sair da conta?"
        actions={[{ label: 'Sair', destructive: true, onPress: () => void auth.signOut() }]}
      />
    </KeyboardAvoidingView>
  );
}

function LinkRow({ icon, label, hint, onPress }: { icon: ReactNode; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.link, pressed && { backgroundColor: colors.pressed }]} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}>
      {icon}
      <View style={styles.flex}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" tone="muted">{hint}</Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 140 },
  avatarWrap: { alignItems: 'center', gap: spacing.sm },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentPink, borderWidth: 3, borderColor: colors.background },
  group: { gap: spacing.md },
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: 'rgba(10,10,11,0.94)' },
});

/** Trocar o @: 1 troca grátis; depois, aviso de que será paga (R$ 9,90, ainda indisponível). */
function UsernameChanger({ username, left, onChanged }: { username: string; left: number; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(username);
  const [busy, setBusy] = useState(false);
  const v = value.trim().toLowerCase().replace(/^@/, '');
  const valid = /^[a-z0-9_.]{3,30}$/.test(v) && v !== username;

  async function confirm() {
    setBusy(true);
    try {
      await repositories.profiles.changeUsername(v);
      toast(`Agora você é @${v}`, 'success');
      setOpen(false);
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível trocar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <PressableScale onPress={() => setOpen(true)} style={uStyles.pill} accessibilityRole="button" accessibilityLabel={`@${username}. Trocar @`}>
        <Text variant="mono" tone="secondary">@{username}</Text>
        <Text variant="mono" tone="accent">trocar</Text>
      </PressableScale>
    );
  }
  return (
    <View style={uStyles.box}>
      <Field label="novo @" value={value} onChangeText={(t) => setValue(t.toLowerCase().replace(/\s/g, ''))} autoCapitalize="none" autoCorrect={false} max={30}
        hint={left > 0 ? 'Você tem 1 troca grátis. As próximas custarão R$ 9,90.' : 'Você já usou sua troca grátis. Novas trocas custarão R$ 9,90 (em breve).'} />
      <View style={uStyles.row}>
        <Button label="Cancelar" variant="ghost" onPress={() => { setOpen(false); setValue(username); }} />
        <Button label={left > 0 ? 'Usar troca grátis' : 'Indisponível'} loading={busy} disabled={!valid || left <= 0} onPress={confirm} />
      </View>
    </View>
  );
}

const uStyles = StyleSheet.create({
  pill: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  box: { alignSelf: 'stretch', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
