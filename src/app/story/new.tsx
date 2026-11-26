import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Camera, Clock3, ImagePlus, MapPin, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DualCamera } from '@/components/camera/DualCamera';
import { Field } from '@/components/form/Field';
import { Appear } from '@/components/motion';
import { Button, Chip, Screen, Text, useToast } from '@/components/ui';
import { pickFromLibrary } from '@/features/compose/photos';
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

  async function fromLibrary() {
    try {
      const [p] = await pickFromLibrary(1, 'story');
      if (p) setPhoto({ photo: p, dual: false });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível abrir suas fotos.', 'error');
    }
  }

  async function publish() {
    if (!photo) return;
    setProgress(0);
    try {
      await repositories.stories.create({ photo: photo.photo, eventId: eventId ?? null, caption: caption.trim() || null, visibility: vis, isDual: photo.dual }, setProgress);
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
              <Image source={{ uri: photo.photo.uri }} style={styles.preview} contentFit="cover" accessibilityLabel="Prévia do story" />
              <Pressable onPress={() => setPhoto(null)} style={styles.remove} accessibilityRole="button" accessibilityLabel="Trocar foto" hitSlop={8}>
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
      <DualCamera format="story" visible={camera} onClose={() => setCamera(false)} onDone={(p, dual) => { setCamera(false); setPhoto({ photo: p, dual }); }} />
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
  preview: { width: '100%', height: '100%', borderRadius: radius.xl },
  remove: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  event: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
