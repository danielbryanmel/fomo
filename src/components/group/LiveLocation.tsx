import { LocateFixed, MapPinned, Navigation, Square } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Appear } from '@/components/motion';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { readFix } from '@/features/location/useLocation';
import { useAsync } from '@/hooks/useAsync';
import { openDirections } from '@/lib/external';
import { formatRelative } from '@/lib/format';
import { distanceM, formatDistance } from '@/lib/geo';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { GeoPoint } from '@/types/domain';

const DURATIONS = [
  { min: 30, label: '30 min' },
  { min: 60, label: '1 h' },
  { min: 120, label: '2 h' },
  { min: 240, label: '4 h' },
];
const REFRESH_MS = 30_000;
const UPDATE_MS = 60_000;

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Localização ao vivo SÓ com o grupo, por tempo limitado — para a volta para casa.
 * Atualiza a cada minuto enquanto o FOMO está aberto; some sozinha quando o prazo acaba.
 */
export function LiveLocation({ groupId, canShare }: { groupId: string; canShare: boolean }) {
  const auth = useAuth();
  const toast = useToast();
  const list = useAsync(() => repositories.groups.locations(groupId).catch(() => []), [groupId]);
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [myPoint, setMyPoint] = useState<GeoPoint | null>(null);
  const refresh = list.refresh;

  const mine = list.data?.find((l) => l.profile.id === auth.profile?.id) ?? null;
  const others = (list.data ?? []).filter((l) => l.profile.id !== auth.profile?.id);
  const sharing = !!mine;
  const sharingRef = useRef(sharing);
  sharingRef.current = sharing;

  // lista dos outros sempre fresca enquanto a tela está aberta
  useEffect(() => {
    const t = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // enquanto compartilho: atualiza minha posição a cada minuto
  const pushMine = useCallback(async () => {
    const f = await readFix();
    if (!f || !sharingRef.current) return;
    setMyPoint(f.point);
    try {
      await repositories.groups.shareLocation(groupId, f.point, f.accuracyM);
    } catch {
      /* prazo acabou: a lista atualiza e o botão volta */
    }
  }, [groupId]);
  useEffect(() => {
    if (!sharing) return;
    const t = setInterval(() => void pushMine().then(refresh), UPDATE_MS);
    return () => clearInterval(t);
  }, [sharing, pushMine, refresh]);

  async function start() {
    setBusy(true);
    try {
      const f = await readFix();
      if (!f) {
        toast('Não consegui sua localização. Libere o acesso nas configurações do navegador.', 'error');
        return;
      }
      setMyPoint(f.point);
      await repositories.groups.shareLocation(groupId, f.point, f.accuracyM, minutes);
      toast('O grupo já vê onde você está', 'success');
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível compartilhar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await repositories.groups.stopSharing(groupId);
      toast('Parou de compartilhar', 'neutral');
      await refresh();
    } catch {
      toast('Não foi possível parar agora.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!canShare && !others.length) return null;
  const origin = myPoint ?? (mine ? { latitude: mine.latitude, longitude: mine.longitude } : null);

  return (
    <View style={styles.root}>

      {canShare ? (
        sharing ? (
          <View style={[styles.card, styles.on]}>
            <View style={styles.row}>
              <LocateFixed size={20} color={colors.accentPink} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">Você está compartilhando</Text>
                <Text variant="caption" tone="secondary">Até as {hhmm(mine!.expiresAt)} · atualiza com o FOMO aberto</Text>
              </View>
            </View>
            <Button label="Parar agora" variant="secondary" icon={<Square size={14} color={colors.text} />} loading={busy} onPress={stop} fullWidth />
          </View>
        ) : (
          <View style={styles.card}>
            <Text variant="caption" tone="secondary">Na volta para casa, deixe quem confirmou no grupo ver onde você está. Desliga sozinho no fim do prazo.</Text>
            <View style={styles.chips}>
              {DURATIONS.map((d) => <Chip key={d.min} label={d.label} selected={minutes === d.min} onPress={() => setMinutes(d.min)} />)}
            </View>
            <Button label="Compartilhar com o grupo" icon={<MapPinned size={16} color={colors.text} />} loading={busy} onPress={start} fullWidth />
          </View>
        )
      ) : null}

      {others.map((l, i) => {
        const d = origin ? distanceM(origin, { latitude: l.latitude, longitude: l.longitude }) : null;
        return (
          <Appear key={l.profile.id} index={i}>
            <View style={styles.person}>
              <Avatar name={l.profile.displayName} url={l.profile.avatarUrl} seed={l.profile.id} size={40} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>{l.profile.displayName}</Text>
                <Text variant="caption" tone="secondary">
                  {formatRelative(l.updatedAt) === 'agora' ? 'agora' : `há ${formatRelative(l.updatedAt)}`}
                  {d != null ? ` · a ${formatDistance(d)} de você` : ''}
                  {l.accuracyM && l.accuracyM > 150 ? ' · aproximada' : ''}
                </Text>
              </View>
              <Button label="Ver" variant="secondary" icon={<Navigation size={14} color={colors.text} />}
                onPress={() => void openDirections(l.latitude, l.longitude, l.profile.displayName)} />
            </View>
          </Appear>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  card: { gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  on: { borderColor: 'rgba(224,51,143,0.5)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface },
});
