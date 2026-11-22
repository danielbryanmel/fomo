import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { LocateOff, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FomoMark } from '@/components/brand/FomoMark';
import { Appear } from '@/components/motion';
import { Ambient, Button, LiveDot, StateView, Text } from '@/components/ui';
import { OptionGrid } from '@/components/ui/OptionGrid';
import { CROWD_LABEL, LIVE_RULES, MUSIC_LABEL, QUEUE_LABEL, VIBE_LABEL } from '@/config/live';
import { readPreciseOnce } from '@/features/location/useLocation';
import { useAsync } from '@/hooks/useAsync';
import { distanceM } from '@/lib/geo';
import { DATA_SOURCE, repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { CrowdLevel, GeoPoint, MusicLevel, QueueLevel, VibeLevel } from '@/types/domain';

type LocState = 'checking' | 'confirmed' | 'far' | 'denied' | 'demo';

const entries = <K extends string>(o: Record<K, string>) => (Object.keys(o) as K[]).map((k) => ({ key: k, label: o[k] }));

/**
 * Relato ao vivo em 3 toques (lotação, vibe, fila; música opcional).
 * Localização: UMA leitura no momento, só para confirmar que a pessoa está no local.
 * Não é salva — o servidor compara e descarta (docs/DATA_MODEL.md › live_reports).
 */
export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const event = useAsync(() => repositories.events.getById(id), [id]);

  const [loc, setLoc] = useState<LocState>('checking');
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [farBy, setFarBy] = useState<number | null>(null);
  const [crowd, setCrowd] = useState<CrowdLevel | null>(null);
  const [vibe, setVibe] = useState<VibeLevel | null>(null);
  const [queue, setQueue] = useState<QueueLevel | null>(null);
  const [music, setMusic] = useState<MusicLevel | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ xp: number; verified: boolean; presenceXp: number } | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function checkLocation() {
    const e = event.data;
    if (!e) return;
    setLoc('checking');
    const p = await readPreciseOnce();
    if (!p) return setLoc('denied');
    setPoint(p);
    const d = distanceM(p, { latitude: e.latitude, longitude: e.longitude });
    if (d <= LIVE_RULES.maxDistanceM) setLoc('confirmed');
    else {
      setFarBy(Math.round(d));
      setLoc('far');
    }
  }

  useEffect(() => {
    if (event.data) void checkLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.data?.id]);

  async function submit() {
    if (!event.data || !point || !crowd || !vibe || !queue) return;
    setSending(true);
    setError(null);
    try {
      const r = await repositories.live.submit({ eventId: event.data.id, crowd, vibe, queue, music, location: point });
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone({ xp: r.xpPending, verified: r.presenceVerified, presenceXp: r.presenceXp });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar agora.');
    } finally {
      setSending(false);
    }
  }

  if (event.loading) return <View style={[styles.root, styles.center]}><ActivityIndicator color={colors.accentPink} /></View>;
  if (!event.data) return <View style={[styles.root, { paddingTop: insets.top }]}><StateView title="Rolê não encontrado" actionLabel="Fechar" onAction={close} /></View>;
  const e = event.data;
  const place = e.venueName ?? e.title;

  if (done) {
    return (
      <View style={[styles.root, styles.center, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Ambient variant="center" intensity={1} />
        <Appear kind="zoom"><View style={styles.doneIcon}><FomoMark size={56} variant="gradient" /></View></Appear>
        <Appear delay={120}><Text variant="display" align="center" accessibilityRole="header">Valeu.</Text></Appear>
        <Appear delay={200}>
          <Text tone="secondary" align="center" style={styles.doneText}>
            Seu relato já aparece para quem está decidindo onde ir. Vale por {LIVE_RULES.reportTtlMin} min.
          </Text>
        </Appear>
        {done.verified ? (
          <Appear delay={300} style={styles.verified}>
            <LiveDot />
            <Text variant="mono" tone="live">presença confirmada · check-in verificado</Text>
          </Appear>
        ) : null}
        <Appear kind="zoom" delay={420} style={styles.xpRow}>
          {done.xp > 0 ? <View style={styles.xp}><Text variant="mono" style={{ color: colors.textOnLive, fontWeight: '700' }}>+{done.xp} xp relato</Text></View> : null}
          {done.presenceXp > 0 ? <View style={styles.xp}><Text variant="mono" style={{ color: colors.textOnLive, fontWeight: '700' }}>+{done.presenceXp} xp presença</Text></View> : null}
        </Appear>
        <Appear delay={520}><Text variant="caption" tone="muted" align="center">XP do relato é confirmado após validação automática.</Text></Appear>
        <View style={styles.doneBtn}><Button label="Voltar" variant="secondary" fullWidth onPress={close} /></View>
      </View>
    );
  }

  const canSend = (loc === 'confirmed' || loc === 'demo') && crowd && vibe && queue && !sending;

  return (
    <View style={styles.root}>
      <Ambient variant="split" intensity={0.7} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 120 }]}>
        <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Fechar"><X size={20} color={colors.text} /></Pressable>
        <Text variant="display" accessibilityRole="header">Como tá o {place}?</Text>

        <View style={styles.locLine} accessibilityLiveRegion="polite">
          {loc === 'checking' ? (
            <><ActivityIndicator size="small" color={colors.textMuted} /><Text variant="mono" tone="muted">confirmando localização…</Text></>
          ) : loc === 'confirmed' ? (
            <><LiveDot /><Text variant="mono" tone="live">localização confirmada · você está aqui</Text></>
          ) : loc === 'demo' ? (
            <><LiveDot color={colors.warning} /><Text variant="mono" style={{ color: colors.warning }}>modo demo · localização simulada</Text></>
          ) : null}
        </View>

        {loc === 'far' || loc === 'denied' ? (
          <View style={styles.locCard}>
            <LocateOff size={20} color={colors.textSecondary} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{loc === 'far' ? `Você está a ~${farBy} m de lá` : 'Precisamos confirmar que você está lá'}</Text>
              <Text variant="caption" tone="secondary">
                {loc === 'far'
                  ? `O relato vale só para quem está no local (até ${LIVE_RULES.maxDistanceM} m). Isso mantém o termômetro confiável.`
                  : 'Uma leitura de localização agora, só para isso. Não guardamos o ponto e não rastreamos você.'}
              </Text>
              <View style={styles.locActions}>
                <Button label="Tentar de novo" variant="secondary" onPress={checkLocation} />
                {DATA_SOURCE === 'mock' ? <Button label="Simular (demo)" variant="ghost" onPress={() => { setPoint({ latitude: e.latitude, longitude: e.longitude }); setLoc('demo'); }} /> : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.form, !(loc === 'confirmed' || loc === 'demo') && styles.disabled]} pointerEvents={loc === 'confirmed' || loc === 'demo' ? 'auto' : 'none'}>
          <OptionGrid label="lotação" options={([1, 2, 3, 4] as CrowdLevel[]).map((k) => ({ key: k, label: CROWD_LABEL[k] }))} value={crowd} onChange={setCrowd} activeColor={(k) => colors.heat[k]} />
          <OptionGrid label="vibe" options={entries(VIBE_LABEL)} value={vibe} onChange={setVibe} />
          <OptionGrid label="fila na entrada" options={entries(QUEUE_LABEL)} value={queue} onChange={setQueue} />
          <OptionGrid label="música / dj" options={entries(MUSIC_LABEL)} value={music} onChange={setMusic} optional />
        </View>

        {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Enviar relato" fullWidth loading={sending} disabled={!canSend} onPress={submit} />
        <Text variant="mono" tone="muted" align="center">seu relato vale por {LIVE_RULES.reportTtlMin} min · anônimo no total</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
  locLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 20, marginTop: -spacing.sm },
  locCard: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  locActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  form: { gap: spacing.xl, marginTop: spacing.sm },
  disabled: { opacity: 0.35 },
  flex: { flex: 1, gap: spacing.xs },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: 'rgba(10,10,12,0.92)' },
  doneIcon: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginBottom: spacing.sm },
  doneText: { maxWidth: 300 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(212,255,63,0.3)' },
  xpRow: { flexDirection: 'row', gap: spacing.sm },
  xp: { backgroundColor: colors.live, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  doneBtn: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 0 },
});
