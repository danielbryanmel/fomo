import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Crosshair, MapPin, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FomoMark } from '@/components/brand/FomoMark';
import { Field } from '@/components/form/Field';
import { ToggleRow } from '@/components/form/ToggleRow';
import { Appear } from '@/components/motion';
import { Ambient, Button, Chip, Text, useToast } from '@/components/ui';
import { neighborhoods } from '@/config/neighborhoods';
import { geocodeAddress, readPreciseOnce } from '@/features/location/useLocation';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { GeoPoint } from '@/types/domain';

const START_HOURS = [12, 14, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2];
const REPEAT = [0, 4, 8] as const;
const hh = (h: number) => `${String(h % 24).padStart(2, '0')}h`;
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WEEK_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

type Loc = { point: GeoPoint; source: 'gps' | 'address' | 'bairro'; label: string };

/** Próximos 14 dias (a "noite" de um dia inclui a madrugada seguinte). */
function nextDays() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, i) => new Date(base.getTime() + i * 86_400_000));
}

const reais = (t: string) => {
  const n = Number(t.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && t.trim() ? Math.round(n * 100) : null;
};

/** Sugerir rolê: entra como pendente e só aparece no mapa depois da moderação. */
export default function SuggestScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const cats = useAsync(() => repositories.events.listCategories(), []);
  const days = useMemo(nextDays, []);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState<number | null>(22);
  const [endHour, setEndHour] = useState<number>(4); // "até" — pode virar a madrugada
  const [repeat, setRepeat] = useState<(typeof REPEAT)[number]>(0);
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [loc, setLoc] = useState<Loc | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [free, setFree] = useState(false);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [ticket, setTicket] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const startsAt = useMemo(() => {
    if (hour === null) return null;
    const d = new Date(days[day]!);
    if (hour < 6) d.setDate(d.getDate() + 1); // madrugada pertence à noite escolhida
    d.setHours(hour, 0, 0, 0);
    return d;
  }, [day, hour, days]);

  // duração = do início até o "até"; se o "até" for menor, é no dia seguinte
  const duration = hour === null ? 0 : ((endHour - hour + 24) % 24) || 24;
  const endOptions = hour === null ? [] : Array.from({ length: 14 }, (_, i) => (hour + 1 + i) % 24);

  const min = free ? 0 : reais(priceMin);
  const max = free ? 0 : (reais(priceMax) ?? min);
  const ticketOk = !ticket.trim() || /^https:\/\/\S+\.\S+/.test(ticket.trim());
  const priceOk = min === null || max === null || max >= min;
  const valid = title.trim().length >= 3 && !!categoryId && !!startsAt && venue.trim().length >= 2 && !!loc && ticketOk && priceOk;

  async function useGps() {
    setLocBusy(true);
    const p = await readPreciseOnce();
    setLocBusy(false);
    if (p) setLoc({ point: p, source: 'gps', label: 'Sua localização atual' });
    else toast('Não foi possível ler sua localização.', 'error');
  }

  async function findAddress() {
    setLocBusy(true);
    const p = await geocodeAddress(address);
    setLocBusy(false);
    if (p) setLoc({ point: p, source: 'address', label: address.trim() });
    else toast('Endereço não encontrado. Tente com número e bairro, ou escolha o bairro abaixo.', 'error');
  }

  async function submit() {
    if (!valid || !startsAt || !loc || !categoryId) return;
    setSending(true);
    try {
      await repositories.events.submit({
        title, categoryId, startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + duration * 3_600_000).toISOString(),
        venueName: venue, address: address || null, location: loc.point,
        priceMinCents: min, priceMaxCents: max, ticketUrl: ticket || null, description: description || null,
        repeatWeeks: repeat,
      });
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast(/rate_limited|Muitas/.test(msg) ? 'Limite de 5 sugestões por dia atingido.' : msg || 'Não foi possível enviar.', 'error');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <View style={[styles.root, styles.center, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Ambient variant="center" intensity={1} />
        <Appear kind="zoom"><View style={styles.doneIcon}><FomoMark size={56} variant="gradient" /></View></Appear>
        <Appear delay={120}><Text variant="display" align="center">Enviado.</Text></Appear>
        <Appear delay={200}>
          <Text tone="secondary" align="center" style={styles.doneText}>
            “{title.trim()}” foi para a fila de moderação. Quando aprovarem, ele entra no mapa e você recebe uma notificação.
          </Text>
        </Appear>
        <Appear delay={320} style={styles.doneBtns}>
          <Button label="Voltar" variant="secondary" fullWidth onPress={close} />
        </Appear>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Ambient variant="split" intensity={0.5} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 140 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Fechar"><X size={20} color={colors.text} /></Pressable>
        <Appear><Text variant="display" accessibilityRole="header">Sugerir um rolê</Text></Appear>
        <Appear index={1}><Text tone="secondary">Só eventos reais e abertos ao público. A moderação confere antes de entrar no mapa.</Text></Appear>

        <Appear index={2} style={styles.group}>
          <Field label="nome do rolê" value={title} onChangeText={setTitle} max={120} placeholder="Ex.: Baile da Lua" />
          <Text variant="mono" tone="muted">categoria</Text>
          <View style={styles.chips}>
            {(cats.data ?? []).map((c) => <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}
            {cats.loading ? <ActivityIndicator color={colors.textMuted} /> : null}
          </View>
        </Appear>

        <Appear index={3} style={styles.group}>
          <Text variant="mono" tone="muted">quando</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {days.map((d, i) => {
              const on = i === day;
              return (
                <Pressable key={i} onPress={() => setDay(i)} style={[styles.day, on && styles.dayOn]} accessibilityRole="button" accessibilityState={{ selected: on }}
                  accessibilityLabel={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}>
                  <Text variant="mono" tone={on ? 'primary' : 'muted'}>{i === 0 ? 'hoje' : WEEK[d.getDay()]}</Text>
                  <Text variant="headline" tone={on ? 'primary' : 'secondary'}>{d.getDate()}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text variant="mono" tone="muted">começa</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
            {START_HOURS.map((h) => (
              <Chip key={h} label={hh(h)} selected={hour === h} onPress={() => { setHour(h); setEndHour((h + 6) % 24); }} />
            ))}
          </ScrollView>
          <Text variant="mono" tone="muted">até</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
            {endOptions.map((h) => <Chip key={h} label={hh(h)} selected={endHour === h} onPress={() => setEndHour(h)} />)}
          </ScrollView>
          {hour !== null ? (
            <Text variant="caption" tone="secondary">De {hh(hour)} até {hh(endHour)}{endHour <= hour ? ' (madrugada)' : ''} · {duration}h de rolê</Text>
          ) : null}
          <Text variant="mono" tone="muted">repete</Text>
          <View style={styles.chips}>
            {REPEAT.map((r) => (
              <Chip key={r} selected={repeat === r} onPress={() => setRepeat(r)}
                label={r === 0 ? 'Não repete' : `${[0, 6].includes(days[day]!.getDay()) ? 'Todo' : 'Toda'} ${WEEK_FULL[days[day]!.getDay()]} · ${r} semanas`} />
            ))}
          </View>
        </Appear>

        <Appear index={4} style={styles.group}>
          <Field label="local" value={venue} onChangeText={setVenue} max={120} placeholder="Nome da casa, bar ou espaço" />
          <Field label="endereço" value={address} onChangeText={setAddress} max={240} placeholder="Rua, número — bairro" onSubmitEditing={findAddress} />
          <Text variant="mono" tone="muted">pin no mapa</Text>
          {loc ? (
            <View style={styles.locOk}>
              <MapPin size={18} color={colors.accentPink} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>{loc.label}</Text>
                <Text variant="caption" tone="muted">
                  {loc.source === 'bairro' ? 'Aproximado (centro do bairro). A moderação ajusta o pin.' : 'Pin preciso.'}
                </Text>
              </View>
              <Pressable onPress={() => setLoc(null)} hitSlop={8} accessibilityLabel="Trocar localização"><X size={16} color={colors.textMuted} /></Pressable>
            </View>
          ) : (
            <>
              <View style={styles.row}>
                {Platform.OS !== 'web' ? <Button label="Achar endereço" variant="secondary" icon={<MapPin size={16} color={colors.text} />} onPress={findAddress} disabled={!address.trim() || locBusy} /> : null}
                <Button label="Estou no local" variant="secondary" icon={<Crosshair size={16} color={colors.text} />} onPress={useGps} disabled={locBusy} />
                {locBusy ? <ActivityIndicator color={colors.textMuted} /> : null}
              </View>
              <Text variant="caption" tone="muted">Ou escolha o bairro (pin aproximado):</Text>
              <View style={styles.chips}>
                {neighborhoods.map((n) => <Chip key={n.id} label={n.name} onPress={() => setLoc({ point: n.center, source: 'bairro', label: n.name })} />)}
              </View>
            </>
          )}
        </Appear>

        <Appear index={5} style={styles.group}>
          <ToggleRow label="Entrada gratuita" value={free} onChange={setFree} />
          {!free ? (
            <View style={styles.row}>
              <View style={styles.flex}><Field label="a partir de (R$)" value={priceMin} onChangeText={setPriceMin} keyboardType="decimal-pad" placeholder="40" /></View>
              <View style={styles.flex}><Field label="até (R$)" value={priceMax} onChangeText={setPriceMax} keyboardType="decimal-pad" placeholder="80" error={priceOk ? null : 'Menor que o mínimo'} /></View>
            </View>
          ) : null}
          <Field label="link de ingresso · opcional" value={ticket} onChangeText={setTicket} autoCapitalize="none" keyboardType="url" placeholder="https://" error={ticketOk ? null : 'Use um link https:// válido.'} />
          <Field label="descrição · opcional" value={description} onChangeText={setDescription} max={4000} multiline placeholder="Line-up, estilo, regras da casa…" />
        </Appear>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Enviar para moderação" icon={valid ? <Check size={18} color={colors.text} /> : undefined} fullWidth loading={sending} disabled={!valid} onPress={submit} />
        <Text variant="mono" tone="muted" align="center">
          {valid ? 'tudo certo' : 'falta: ' + [title.trim().length < 3 && 'nome', !categoryId && 'categoria', venue.trim().length < 2 && 'local', !loc && 'pin'].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hscroll: { gap: spacing.sm, paddingRight: spacing.lg },
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
  group: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  days: { gap: spacing.sm },
  day: { width: 56, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', gap: 2, backgroundColor: colors.surface },
  dayOn: { borderColor: colors.accentPink, backgroundColor: colors.surfaceRaised },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  flex: { flex: 1 },
  locOk: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentPink },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: 'rgba(10,10,11,0.94)' },
  doneIcon: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginBottom: spacing.sm },
  doneText: { maxWidth: 320 },
  doneBtns: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xl },
});
