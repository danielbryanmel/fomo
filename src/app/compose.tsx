import { StarInput } from '@/components/form/StarInput';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Check, ImagePlus, MapPin, X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, ProgressBar, Text, useToast } from '@/components/ui';
import { MAX_PHOTOS, pickFromLibrary, takePhoto } from '@/features/compose/photos';
import { useAsync } from '@/hooks/useAsync';
import { postCreated } from '@/lib/bus';
import { regionToBounds } from '@/lib/geo';
import { repositories } from '@/repositories';
import { colors, hitTarget, radius, spacing, typography } from '@/theme';
import type { ContentVisibility, LocalPhoto, MapEvent } from '@/types/domain';

const MAX_CAPTION = 2200;
const PAST_DAYS = Array.from({ length: 60 }, (_, i) => i);
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const todayISO = (offsetDays = 0) => {
  const d = new Date(Date.now() - offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Nova publicação ("rolê vivido") — fotos primeiro, como num app de fotos.
 * Diferente de "divulgar evento": aqui é experiência que a pessoa viveu.
 * "Eu estive lá" só DECLARA presença; nunca vira "confirmada" por aqui.
 */
export default function ComposeScreen() {
  const params = useLocalSearchParams<{ eventId?: string; source?: 'camera' | 'library' }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [busyPick, setBusyPick] = useState(false);
  const [body, setBody] = useState('');
  const [placeText, setPlaceText] = useState('');
  const [event, setEvent] = useState<MapEvent | null>(null);
  const [date, setDate] = useState<string | null>(todayISO());
  const [rating, setRating] = useState<number | null>(null);
  const [declare, setDeclare] = useState(false);
  const [visibility, setVisibility] = useState<ContentVisibility>('public');
  const [progress, setProgress] = useState<number | null>(null);

  // sugestões de lugar: o que está rolando/aconteceu hoje (área ampla)
  const suggestions = useAsync(
    () =>
      repositories.events.listForMap({
        bounds: regionToBounds({ latitude: -23.55, longitude: -46.65, latitudeDelta: 0.6, longitudeDelta: 0.6 }),
        origin: null,
        date: 'today',
        limit: 12,
      }),
    [],
  );
  // "Tirar foto agora": abre a câmera direto no app (na Web o navegador exige um toque)
  useEffect(() => {
    if (params.source === 'camera' && Platform.OS !== 'web') void addFromCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // chegou a partir da tela de um evento → já vem marcado
  useEffect(() => {
    const pre = suggestions.data?.find((e) => e.id === params.eventId);
    if (pre) setEvent((cur) => cur ?? pre);
  }, [suggestions.data, params.eventId]);

  const placeName = event ? (event.venueName ?? event.title) : placeText.trim() || null;
  const canPublish = (photos.length > 0 || body.trim().length > 0) && progress === null;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/feed'));

  async function addFromLibrary() {
    setBusyPick(true);
    try {
      const more = await pickFromLibrary(MAX_PHOTOS - photos.length);
      setPhotos((p) => [...p, ...more].slice(0, MAX_PHOTOS));
    } catch {
      toast('Não foi possível abrir suas fotos.', 'error');
    } finally {
      setBusyPick(false);
    }
  }
  async function addFromCamera() {
    setBusyPick(true);
    try {
      const r = await takePhoto();
      if (r.denied) toast('Permita o acesso à câmera nos ajustes para tirar fotos.', 'error');
      setPhotos((p) => [...p, ...r.photos].slice(0, MAX_PHOTOS));
    } catch {
      toast('Câmera indisponível neste dispositivo.', 'error');
    } finally {
      setBusyPick(false);
    }
  }

  async function publish() {
    if (!canPublish) return;
    setProgress(0);
    try {
      const created = await repositories.posts.create(
        {
          photos,
          body: body.slice(0, MAX_CAPTION),
          eventId: event?.id ?? null,
          placeName,
          experienceDate: date,
          categoryId: event?.categoryId ?? null,
          rating,
          visibility,
          declarePresence: declare && !!placeName,
        },
        setProgress,
      );
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      postCreated.emit(created);
      toast('Publicado', 'success');
      // seus posts aparecem em "Seguindo" (o "Para você" mostra a comunidade)
      router.replace({ pathname: '/feed', params: { tab: 'following' } });
    } catch (e) {
      setProgress(null);
      toast(e instanceof Error ? e.message : 'Não foi possível publicar. Tente de novo.', 'error');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Topo */}
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={close} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Cancelar"><X size={20} color={colors.text} /></Pressable>
        <Text variant="headline" style={styles.flex} align="center">Novo rolê</Text>
        <Pressable
          onPress={publish}
          disabled={!canPublish}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPublish }}
          style={[styles.publish, !canPublish && { opacity: 0.4 }]}
        >
          {progress !== null ? <ActivityIndicator color={colors.text} size="small" /> : <Text variant="bodyStrong" tone="accent">Publicar</Text>}
        </Pressable>
      </View>
      {progress !== null ? <ProgressBar value={progress} height={3} accessibilityLabel="Enviando publicação" /> : null}

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]} keyboardShouldPersistTaps="handled">
        {/* Fotos */}
        {photos.length === 0 ? (
          <View style={styles.emptyPhotos}>
            <Pressable onPress={addFromLibrary} style={({ pressed }) => [styles.bigPick, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Escolher fotos da galeria">
              {busyPick ? <ActivityIndicator color={colors.accentPink} /> : <ImagePlus size={36} color={colors.accentPink} />}
              <Text variant="headline">Adicionar fotos</Text>
              <Text variant="caption" tone="muted">Até {MAX_PHOTOS} · a localização gravada na foto é removida</Text>
            </Pressable>
            <Pressable onPress={addFromCamera} style={({ pressed }) => [styles.camPick, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Tirar foto">
              <Camera size={22} color={colors.text} />
              <Text variant="bodyStrong">Câmera</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {photos.map((p, i) => (
              <View key={p.uri + i} style={styles.thumb}>
                <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                {i === 0 ? <View style={styles.coverTag}><Text variant="mono" style={{ fontSize: 9 }}>capa</Text></View> : null}
                <Pressable onPress={() => setPhotos((list) => list.filter((_, j) => j !== i))} style={styles.remove} accessibilityRole="button" accessibilityLabel={`Remover foto ${i + 1}`}>
                  <X size={14} color={colors.text} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <View style={styles.addCol}>
                <Pressable onPress={addFromLibrary} style={styles.addTile} accessibilityRole="button" accessibilityLabel="Adicionar mais fotos">
                  {busyPick ? <ActivityIndicator color={colors.textMuted} /> : <ImagePlus size={22} color={colors.textSecondary} />}
                </Pressable>
                <Pressable onPress={addFromCamera} style={styles.addTile} accessibilityRole="button" accessibilityLabel="Tirar foto">
                  <Camera size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        )}

        {/* Legenda */}
        <View style={styles.field}>
          <TextInput
            value={body}
            onChangeText={(t) => setBody(t.slice(0, MAX_CAPTION))}
            placeholder={photos.length ? 'Escreva uma legenda…' : 'Como foi o rolê?'}
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.caption}
            accessibilityLabel="Legenda"
          />
          {body.length > MAX_CAPTION * 0.8 ? <Text variant="mono" tone="muted" align="right">{body.length}/{MAX_CAPTION}</Text> : null}
        </View>

        {/* Onde */}
        <Section label="onde foi">
          {event ? (
            <View style={styles.selectedPlace}>
              <MapPin size={16} color={colors.accentPink} />
              <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>{event.title}{event.venueName && event.venueName !== event.title ? ` · ${event.venueName}` : ''}</Text>
              <Pressable onPress={() => { setEvent(null); setDeclare(false); }} accessibilityRole="button" accessibilityLabel="Remover lugar" hitSlop={10}><X size={16} color={colors.textMuted} /></Pressable>
            </View>
          ) : (
            <>
              <View style={styles.inputRow}>
                <MapPin size={16} color={colors.textMuted} />
                <TextInput value={placeText} onChangeText={setPlaceText} placeholder="Nome do lugar (opcional)" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Nome do lugar" />
              </View>
              {suggestions.data?.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
                  {suggestions.data.map((e) => (
                    <Chip key={e.id} label={e.venueName ?? e.title} onPress={() => { setEvent(e); setPlaceText(''); }} />
                  ))}
                </ScrollView>
              ) : null}
            </>
          )}
        </Section>

        {/* Quando: hoje, ontem ou qualquer dia dos últimos 60 */}
        <Section label="quando">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {PAST_DAYS.map((off) => {
              const iso = todayISO(off);
              const d = new Date(`${iso}T12:00:00`);
              const label = off === 0 ? 'Hoje' : off === 1 ? 'Ontem' : `${WEEK[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
              return <Chip key={off} label={label} selected={date === iso} onPress={() => setDate(iso)} />;
            })}
            <Chip label="Sem data" selected={date === null} onPress={() => setDate(null)} />
          </ScrollView>
        </Section>

        {/* Nota (aceita meia estrela) */}
        <Section label="sua nota · opcional">
          <StarInput value={rating ?? 0} onChange={(n) => setRating(n || null)} />
        </Section>

        {/* Presença */}
        {placeName ? (
          <View style={styles.toggleRow}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">Eu estive lá</Text>
              <Text variant="caption" tone="muted">Aparece como "Disse que esteve" — não como presença confirmada.</Text>
            </View>
            <Switch value={declare} onValueChange={setDeclare} trackColor={{ true: colors.accentPink, false: colors.borderStrong }} thumbColor={colors.text} accessibilityLabel="Declarar que esteve lá" />
          </View>
        ) : null}

        {/* Visibilidade */}
        <Section label="quem pode ver">
          <View style={styles.chipsWrap}>
            {([['public', 'Todos'], ['followers', 'Seguidores'], ['private', 'Só eu']] as const).map(([k, l]) => (
              <Chip key={k} label={l} selected={visibility === k} onPress={() => setVisibility(k)} />
            ))}
          </View>
        </Section>

        <View style={styles.note}>
          <Check size={14} color={colors.textMuted} />
          <Text variant="caption" tone="muted" style={styles.flex}>
            Publicações com foto ou texto com conteúdo rendem XP (com limite diário). Você pode editar a legenda ou excluir depois.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="mono" tone="muted">{label}</Text>
      {children}
    </View>
  );
}

const THUMB = 132;

const styles = StyleSheet.create({
  dayRow: { gap: spacing.sm, paddingRight: spacing.lg },
  root: { flex: 1, backgroundColor: colors.background },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  publish: { minWidth: 80, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  flex: { flex: 1 },
  content: { gap: spacing.xl, paddingTop: spacing.md },
  emptyPhotos: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  bigPick: { flex: 1, aspectRatio: 0.95, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  camPick: { width: 96, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  strip: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  thumb: { width: THUMB, height: THUMB * 1.25, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  coverTag: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: 'rgba(10,10,12,0.75)' },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,10,12,0.8)' },
  addCol: { gap: spacing.sm },
  addTile: { width: 72, height: (THUMB * 1.25 - spacing.sm) / 2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  field: { paddingHorizontal: spacing.lg },
  caption: { minHeight: 72, color: colors.text, fontSize: typography.body.fontSize, lineHeight: 22, textAlignVertical: 'top', paddingVertical: spacing.sm },
  section: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: hitTarget, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontSize: typography.body.fontSize, paddingVertical: spacing.sm },
  selectedPlace: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: hitTarget, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentPink },
  chips: { gap: spacing.sm },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  note: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
});
