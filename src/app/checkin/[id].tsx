import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Camera, EyeOff, Globe, ImagePlus, Lock, ShieldCheck, Users, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DualCamera } from '@/components/camera/DualCamera';
import { Field } from '@/components/form/Field';
import { Appear, PressableScale } from '@/components/motion';
import { Button, Chip, Screen, Skeleton, StateView, Text, useToast } from '@/components/ui';
import { pickFromLibrary } from '@/features/compose/photos';
import { useAsync } from '@/hooks/useAsync';
import { checkinOpen } from '@/lib/events';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { CheckinVisibility, LocalPhoto } from '@/types/domain';

type Vis = Exclude<CheckinVisibility, 'followers'>;
const OPTIONS: { key: Vis; title: string; desc: string; icon: ReactNode }[] = [
  { key: 'public', title: 'Público', desc: 'Aparece para quem abrir o rolê e no seu perfil.', icon: <Globe size={20} color={colors.text} /> },
  { key: 'friends', title: 'Só amigos', desc: 'Só quem você segue e te segue de volta.', icon: <Users size={20} color={colors.text} /> },
  { key: 'private', title: 'Anônimo', desc: 'Ninguém vê que é você. Só soma no número do rolê.', icon: <EyeOff size={20} color={colors.text} /> },
];

/** Minutos até amanhã às 10h (máx. 24 h, como no banco). */
function untilTomorrowMorning() {
  const t = new Date();
  t.setDate(t.getDate() + (t.getHours() < 6 ? 0 : 1));
  t.setHours(10, 0, 0, 0);
  return Math.min(1440, Math.max(60, Math.round((t.getTime() - Date.now()) / 60_000)));
}
const REVEAL = [
  { key: 'now', label: 'Agora', minutes: () => 0 },
  { key: '2h', label: 'Daqui 2 h', minutes: () => 120 },
  { key: 'tomorrow', label: 'Amanhã de manhã', minutes: untilTomorrowMorning },
] as const;
type RevealKey = (typeof REVEAL)[number]['key'];

/**
 * Check-in seguro. A presença SEMPRE soma no rolê (como número, e só a partir de 3 pessoas),
 * mas quem vê que é você, e quando, é escolha sua — pensado contra perseguição e stalkers.
 */
export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const event = useAsync(() => repositories.events.getById(id), [id]);
  const presence = useAsync(() => repositories.checkins.presence(id), [id]);
  const settings = useAsync(() => repositories.profiles.settings().catch(() => null), []);
  const [vis, setVis] = useState<Vis>('friends');
  const [reveal, setReveal] = useState<RevealKey>('now');
  const [photo, setPhoto] = useState<{ photo: LocalPhoto; dual: boolean } | null>(null);
  const [caption, setCaption] = useState('');
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);

  // começa no que a pessoa já escolheu (check-in atual ou padrão das configurações)
  useEffect(() => {
    const me = presence.data?.me;
    const base = me?.visibility ?? settings.data?.defaultCheckinVisibility;
    if (base) setVis(base === 'followers' ? 'friends' : base);
    if (me?.revealAt && new Date(me.revealAt).getTime() > Date.now()) setReveal('2h');
  }, [presence.data?.me, settings.data?.defaultCheckinVisibility]);

  if (event.loading || presence.loading) return <Screen><View style={styles.pad}><Skeleton height={120} /><Skeleton height={220} /></View></Screen>;
  const e = event.data;
  if (!e) return <Screen><StateView title="Rolê não encontrado" /></Screen>;
  if (!checkinOpen(e)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Check-in' }} />
        <StateView icon={<Lock size={26} color={colors.textSecondary} />} title="Check-in fechado" description="O check-in abre 3 h antes do rolê e fecha 2 h depois do fim." />
      </Screen>
    );
  }

  const me = presence.data?.me ?? null;
  const hidden = vis === 'private' || reveal !== 'now';
  const canPhoto = !hidden; // uma foto agora entregaria que você está lá

  async function submit() {
    setBusy(true);
    try {
      const minutes = vis === 'private' ? 0 : REVEAL.find((r) => r.key === reveal)!.minutes();
      await repositories.checkins.checkIn(id, vis, minutes);
      if (photo && canPhoto) {
        await repositories.stories.create({
          photo: photo.photo, eventId: id, caption: caption.trim() || null, isDual: photo.dual,
          visibility: vis === 'public' ? 'public' : 'friends',
        });
      }
      toast(vis === 'private' ? 'Check-in anônimo feito. Você soma no rolê sem aparecer.' : minutes ? 'Check-in feito. Sua presença aparece mais tarde.' : 'Check-in feito!', 'success');
      router.canGoBack() ? router.back() : router.replace({ pathname: '/event/[id]', params: { id } });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível fazer o check-in.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      await repositories.checkins.checkOut(id);
      toast('Check-in apagado.', 'neutral');
      router.canGoBack() ? router.back() : router.replace('/');
    } catch {
      toast('Não foi possível apagar agora.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function fromLibrary() {
    const [p] = await pickFromLibrary(1);
    if (p) setPhoto({ photo: p, dual: false });
  }

  return (
    <Screen bleed edges={['bottom']}>
      <Stack.Screen options={{ title: me ? 'Seu check-in' : 'Check-in' }} />
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Appear>
          <View style={styles.head}>
            <Text variant="mono" tone="muted">{me ? 'você está aqui' : 'fazer check-in em'}</Text>
            <Text variant="display">{e.title}</Text>
            {e.venueName ? <Text variant="mono" tone="secondary">{e.venueName}</Text> : null}
          </View>
        </Appear>

        <View style={styles.section}>
          <Text variant="mono" tone="muted">quem vê que você está aqui</Text>
          {OPTIONS.map((o, i) => {
            const on = vis === o.key;
            return (
              <Appear key={o.key} index={i}>
                <PressableScale onPress={() => setVis(o.key)} scaleTo={0.98} style={[styles.opt, on && styles.optOn]}
                  accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${o.title}. ${o.desc}`}>
                  <View style={[styles.icon, on && styles.iconOn]}>{o.icon}</View>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{o.title}</Text>
                    <Text variant="caption" tone="secondary">{o.desc}</Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                </PressableScale>
              </Appear>
            );
          })}
        </View>

        {vis !== 'private' ? (
          <View style={styles.section}>
            <Text variant="mono" tone="muted">quando seu nome aparece</Text>
            <View style={styles.chips}>
              {REVEAL.map((r) => <Chip key={r.key} label={r.label} selected={reveal === r.key} onPress={() => setReveal(r.key)} />)}
            </View>
            {reveal !== 'now' ? <Text variant="caption" tone="secondary">Até lá, ninguém vê que é você — nem em "quem tá indo". Bom para não avisar onde você está enquanto ainda está lá.</Text> : null}
          </View>
        ) : null}

        <View style={styles.safe}>
          <ShieldCheck size={20} color={colors.accentPink} />
          <Text variant="caption" tone="secondary" style={styles.flex}>
            Sua presença sempre ajuda o termômetro do rolê, mas só como número — e o número só aparece a partir de 3 pessoas. O FOMO nunca mostra sua localização exata.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="mono" tone="muted">foto do rolê · vira story de 24 h</Text>
          {!canPhoto ? (
            <Text variant="caption" tone="muted">{vis === 'private' ? 'No modo anônimo a foto fica desligada: ela mostraria que você está aqui.' : 'Com o nome aparecendo mais tarde, a foto fica desligada para não te entregar agora. Poste depois pelo +.'}</Text>
          ) : photo ? (
            <View style={styles.photoRow}>
              <View style={styles.thumbWrap}>
                <Image source={{ uri: photo.photo.uri }} style={styles.thumb} contentFit="cover" />
                <Pressable onPress={() => setPhoto(null)} style={styles.remove} accessibilityRole="button" accessibilityLabel="Remover foto" hitSlop={8}>
                  <X size={14} color={colors.text} />
                </Pressable>
              </View>
              <View style={styles.flex}>
                <Field label="legenda (opcional)" value={caption} onChangeText={setCaption} max={140} placeholder="como tá aí?" />
                <Text variant="caption" tone="muted">{photo.dual ? 'Câmera dupla · ' : ''}{vis === 'public' ? 'story público' : 'story só para amigos'}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.row}>
              <View style={styles.flex}><Button label="Câmera dupla" variant="secondary" icon={<Camera size={16} color={colors.text} />} onPress={() => setCamera(true)} fullWidth /></View>
              <View style={styles.flex}><Button label="Galeria" variant="secondary" icon={<ImagePlus size={16} color={colors.text} />} onPress={fromLibrary} fullWidth /></View>
            </View>
          )}
        </View>

        <Button label={me ? 'Atualizar check-in' : 'Fazer check-in'} loading={busy} onPress={submit} fullWidth />
        {me ? <Button label="Apagar meu check-in" variant="ghost" onPress={leave} disabled={busy} /> : null}
      </ScrollView>
      <DualCamera visible={camera} onClose={() => setCamera(false)} onDone={(p, dual) => { setCamera(false); setPhoto({ photo: p, dual }); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },
  head: { gap: spacing.xs },
  section: { gap: spacing.sm },
  opt: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 72, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  optOn: { borderColor: colors.accentPink, backgroundColor: 'rgba(232,54,140,0.08)' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  iconOn: { backgroundColor: 'rgba(232,54,140,0.25)' },
  flex: { flex: 1, gap: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accentPink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentPink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  safe: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(232,54,140,0.3)', alignItems: 'flex-start' },
  row: { flexDirection: 'row', gap: spacing.sm },
  photoRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  thumbWrap: { width: 96, height: 128 },
  thumb: { width: 96, height: 128, borderRadius: radius.md },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
});
