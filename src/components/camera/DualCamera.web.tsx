import { Camera, RefreshCcw, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';
import type { LocalPhoto } from '@/types/domain';
import { composeDual, grabFrame } from './compose';
import type { DualCameraProps } from './DualCamera';

type Phase = 'starting' | 'back' | 'front' | 'working' | 'review' | 'error';

/**
 * Câmera dupla (Web/PWA): tira a foto com a câmera traseira e, logo em seguida,
 * uma selfie com a frontal — as duas viram UMA imagem (selfie no canto).
 * Nenhum vídeo é gravado; os quadros ficam só no aparelho até você publicar.
 */
export function DualCamera({ visible, onClose, onDone, format = 'post' }: DualCameraProps) {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<{ photo: LocalPhoto; dual: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const start = useCallback(async (facing: 'environment' | 'user') => {
    stop();
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    stream.current = s;
    const v = videoRef.current;
    if (v) {
      v.srcObject = s;
      await v.play().catch(() => {});
      // espera o primeiro quadro de verdade (evita foto preta no iPhone)
      if (!v.videoWidth) await new Promise((r) => v.addEventListener('loadeddata', r, { once: true }));
    }
  }, [stop]);

  useEffect(() => {
    if (!visible) return;
    setResult(null);
    setError(null);
    setPhase('starting');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador não libera a câmera. Use a galeria.');
      setPhase('error');
      return;
    }
    start('environment').then(() => setPhase('back')).catch(() => {
      setError('Sem acesso à câmera. Libere nas configurações do navegador (Ajustes › Safari › Câmera).');
      setPhase('error');
    });
    return stop;
  }, [visible, start, stop]);

  async function shoot() {
    const v = videoRef.current;
    if (!v) return;
    const back = grabFrame(v);
    setPhase('front');
    let front: HTMLCanvasElement | null = null;
    try {
      await start('user');
      for (let i = 2; i > 0; i--) {
        setCount(i);
        await new Promise((r) => setTimeout(r, 800));
      }
      setCount(0);
      front = grabFrame(videoRef.current!);
    } catch {
      front = null; // aparelho com uma câmera só: segue com a traseira
    }
    stop();
    setPhase('working');
    try {
      const photo = await composeDual(back, front, format === 'story' ? { w: 1080, h: 1920 } : undefined);
      setResult({ photo, dual: !!front });
      setPhase('review');
    } catch {
      setError('Não foi possível montar a foto. Tente de novo.');
      setPhase('error');
    }
  }

  function retake() {
    if (result) URL.revokeObjectURL(result.photo.uri);
    setResult(null);
    setPhase('starting');
    start('environment').then(() => setPhase('back')).catch(() => setPhase('error'));
  }

  function close() {
    stop();
    if (result) URL.revokeObjectURL(result.photo.uri);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} transparent={false}>
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.top}>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Fechar câmera" style={styles.round} hitSlop={8}>
            <X size={22} color={colors.text} />
          </Pressable>
          <Text variant="mono" tone="secondary">{phase === 'front' ? 'agora a selfie' : phase === 'review' ? 'ficou assim' : 'câmera dupla'}</Text>
          <View style={styles.round} />
        </View>

        <View style={[styles.stage, format === 'story' && styles.stageStory]}>
          {phase !== 'review' ? (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 28, background: '#000', transform: phase === 'front' ? 'scaleX(-1)' : undefined }}
            />
          ) : result ? (
            <Image source={{ uri: result.photo.uri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Prévia da foto" />
          ) : null}
          {phase === 'starting' || phase === 'working' ? <View style={styles.center}><ActivityIndicator color={colors.text} /></View> : null}
          {phase === 'front' && count > 0 ? (
            <View style={styles.center} pointerEvents="none"><Text style={styles.count}>{count}</Text></View>
          ) : null}
          {phase === 'error' ? (
            <View style={styles.center}><Text tone="secondary" style={styles.err}>{error}</Text></View>
          ) : null}
        </View>

        <View style={styles.bottom}>
          {phase === 'back' ? (
            <>
              <Text variant="caption" tone="muted" style={styles.hint}>Primeiro o rolê, depois a selfie — automático.</Text>
              <Pressable onPress={shoot} accessibilityRole="button" accessibilityLabel="Tirar foto" style={styles.shutter}>
                <View style={styles.shutterInner}><Camera size={26} color={colors.background} /></View>
              </Pressable>
            </>
          ) : phase === 'review' && result ? (
            <View style={styles.row}>
              <View style={styles.flex}><Button label="Refazer" variant="secondary" icon={<RefreshCcw size={16} color={colors.text} />} onPress={retake} fullWidth /></View>
              <View style={styles.flex}><Button label="Usar foto" onPress={() => { stop(); onDone(result.photo, result.dual); }} fullWidth /></View>
            </View>
          ) : phase === 'error' ? (
            <Button label="Fechar" variant="secondary" onPress={close} fullWidth />
          ) : (
            <View style={styles.shutterSpace} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md, gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  stage: { flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: '#000' },
  // story: o quadro mostra exatamente o que sai na foto (9:16)
  stageStory: { flex: 0, height: undefined, width: '100%', maxHeight: '100%', aspectRatio: 9 / 16, alignSelf: 'center' },
  preview: { width: '100%', height: '100%' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  count: { fontSize: 96, fontWeight: '800', color: colors.text },
  err: { textAlign: 'center' },
  bottom: { alignItems: 'center', gap: spacing.sm, minHeight: 96, justifyContent: 'center' },
  hint: { textAlign: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: radius.xl, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  shutterSpace: { height: 78 },
  row: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  flex: { flex: 1 },
});
