import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Camera, Clock3, ImagePlus, MapPin, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DualCamera } from '@/components/camera/DualCamera';
import { Field } from '@/components/form/Field';
import { Appear } from '@/components/motion';
import { Button, Chip, Screen, Text, useToast } from '@/components/ui';
import { pickFromLibrary, prepareCover, STORY_H, STORY_W } from '@/features/compose/photos';
import { storyCache } from '@/features/stories';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { LocalPhoto, StoryVisibility } from '@/types/domain';

const VIS: { key: StoryVisibility; label: string }[] = [
  { key: 'followers', label: 'Seguidores' },
  { key: 'friends', label: 'Só amigos' },
  { key: 'public', label: 'Todos' },
];

/** Novo story (some em 24 h): galeria ou câmera dupla, legenda e quem vê. */
export default function NewStoryScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const toast = useToast();
  const event = useAsync(async () => (eventId ? repositories.events.getById(eventId) : null), [eventId]);
  const [photo, setPhoto] = useState<{ photo: LocalPhoto; dual: boolean } | null>(null);
  const [caption, setCaption] = useState('');
  const [vis, setVis] = useState<StoryVisibility>('followers');
  const [camera, setCamera] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  // foto da galeria: guardamos a original (já reduzida) e a pessoa arrasta para enquadrar; o recorte 9:16 sai na hora de publicar
  const [raw, setRaw] = useState<LocalPhoto | null>(null);
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 });
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const start = useRef(focus);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.current = focusRef.current; },
    onPanResponderMove: (_, g) => {
      const r = rawRef.current;
      const f = frameRef.current;
      if (!r || !f.w) return;
      const ratio = r.width / r.height;
      const over = ratio > f.w / f.h ? { x: f.h * ratio - f.w, y: 0 } : { x: 0, y: f.w / ratio - f.h };
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      setFocus({
        x: over.x ? clamp(start.current.x - g.dx / over.x) : 0.5,
        y: over.y ? clamp(start.current.y - g.dy / over.y) : 0.5,
      });
    },
  }), []);
  const focusRef = useRef(focus); focusRef.current = focus;
  const rawRef = useRef(raw); rawRef.current = raw;
  const frameRef = useRef(frame); frameRef.current = frame;

  async function fromLibrary() {
    try {
      const [p] = await pickFromLibrary(1);
      if (p) {
        setRaw(p);
        setFocus({ x: 0.5, y: 0.5 });
        setPhoto({ photo: p, dual: false });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível abrir suas fotos.', 'error');
    }
  }

  async function publish() {
    if (!photo) return;
    setProgress(0);
    try {
      const final = raw ? await prepareCover(raw, STORY_W, STORY_H, focus) : photo.photo;
      await repositories.stories.create({ photo: final, eventId: eventId ?? null, caption: caption.trim() || null, visibility: vis, isDual: photo.dual }, setProgress);
      storyCache.changed();
      toast('Story no ar por 24 h', 'success');
      router.canGoBack() ? router.back() : router.replace('/feed');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível publicar.', 'error');
    } finally {
      setProgress(null);
    }
  }

  return (
    <Screen bleed edges={['bottom']}>
      <Stack.Screen options={{ title: 'Novo story' }} />
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        {photo ? (
          <Appear>
            <View style={styles.previewWrap}>
              <View style={styles.preview} onLayout={(e) => setFrame({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...(raw ? pan.panHandlers : {})}>
                <Image
                  source={{ uri: photo.photo.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  contentPosition={{ left: `${Math.round(focus.x * 100)}%`, top: `${Math.round(focus.y * 100)}%` }}
                  accessibilityLabel="Prévia do story"
                />
                {raw ? <View style={styles.hint} pointerEvents="none"><Text variant="caption" style={{ fontWeight: '700' }}>Arraste para enquadrar</Text></View> : null}
              </View>
              <Pressable onPress={() => { setPhoto(null); setRaw(null); }} style={styles.remove} accessibilityRole="button" accessibilityLabel="Trocar foto" hitSlop={8}>
                <X size={16} color={colors.text} />
              </Pressable>
            </View>
          </Appear>
        ) : (
          <View style={styles.pick}>
            <Text variant="headline">Mostra o rolê</Text>
            <Text tone="secondary" style={styles.center}>A câmera dupla tira o rolê e, logo depois, sua selfie — numa foto só.</Text>
            <View style={styles.row}>
              <View style={styles.flex}><Button label="Câmera" icon={<Camera size={16} color={colors.text} />} onPress={() => setCamera(true)} fullWidth /></View>
              <View style={styles.flex}><Button label="Galeria" variant="secondary" icon={<ImagePlus size={16} color={colors.text} />} onPress={fromLibrary} fullWidth /></View>
            </View>
          </View>
        )}

        {event.data ? (
          <View style={styles.event}>
            <MapPin size={14} color={colors.accentPink} />
            <Text variant="caption" tone="secondary" numberOfLines={1}>{event.data.title}</Text>
          </View>
        ) : null}

        <Field label="legenda (opcional)" value={caption} onChangeText={setCaption} max={140} placeholder="como tá aí?" />

        <View style={styles.section}>
          <Text variant="mono" tone="muted">quem vê</Text>
          <View style={styles.chips}>{VIS.map((v) => <Chip key={v.key} label={v.label} selected={vis === v.key} onPress={() => setVis(v.key)} />)}</View>
          <View style={styles.note}>
            <Clock3 size={14} color={colors.textMuted} />
            <Text variant="caption" tone="muted" style={styles.flex}>Some em 24 h. Você vê quem visualizou.{event.data ? ' Um story marcado num rolê mostra que você está lá agora.' : ''}</Text>
          </View>
        </View>

        <Button label={progress != null ? `Publicando… ${Math.round(progress * 100)}%` : 'Publicar story'} disabled={!photo} loading={progress != null} onPress={publish} fullWidth />
      </ScrollView>
      <DualCamera format="story" visible={camera} onClose={() => setCamera(false)} onDone={(p, dual) => { setCamera(false); setRaw(null); setPhoto({ photo: p, dual }); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },
  pick: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  flex: { flex: 1 },
  previewWrap: { alignSelf: 'center', width: '62%', aspectRatio: 9 / 16 },
  preview: { width: '100%', height: '100%', borderRadius: radius.xl, overflow: 'hidden' },
  hint: { position: 'absolute', bottom: spacing.md, alignSelf: 'center', backgroundColor: 'rgba(10,10,11,0.7)', borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  remove: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  event: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
