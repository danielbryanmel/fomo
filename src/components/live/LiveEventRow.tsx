import { Pressable, StyleSheet, View } from 'react-native';
import { DemoTag } from '@/components/ui/DemoTag';
import { Text } from '@/components/ui/Text';
import { CROWD_LABEL, MUSIC_LABEL, VIBE_LABEL } from '@/config/live';
import { formatDistance } from '@/lib/geo';
import { formatEventDate, formatPrice, formatRelative } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';
import type { MapEvent } from '@/types/domain';
import { CrowdPill } from './CrowdPill';
import { CoverArt } from '@/components/event/CoverArt';

type Props = { event: MapEvent; selected?: boolean; onPress: () => void };

/** Linha da lista (redesign): foto, nome, metadados, frescor do dado e etiqueta de lotação. Sem card. */
export function LiveEventRow({ event: e, selected, onPress }: Props) {
  const live = e.live;
  const meta = [e.category.name, e.venueName && e.venueName !== e.title ? e.venueName : null, formatDistance(e.distanceM)]
    .filter(Boolean)
    .join(' · ');
  const footerLeft = live?.crowd
    ? [live.vibe ? VIBE_LABEL[live.vibe] : null, live.music ? `som ${MUSIC_LABEL[live.music].toLowerCase()}` : null].filter(Boolean).join(' · ')
    : e.happeningNow
      ? 'rolando agora'
      : formatEventDate(e.startsAt);
  const footerRight = live?.crowd
    ? `${live.reportsCount} relatos · há ${formatRelative(live.lastReportAt!)}`
    : e.happeningNow
      ? 'poucos relatos'
      : formatPrice(e.priceMinCents, e.priceMaxCents);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${e.title}. ${meta}. ${live?.crowd ? `Lotação ${CROWD_LABEL[live.crowd]}, ${live.reportsCount} relatos.` : footerLeft}`}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.thumb}>
        <CoverArt uri={e.coverUrl} seed={e.id} category={e.category.slug} rounded={12} style={styles.thumbImg} />
      </View>
      <View style={styles.flex}>
        <Text variant="headline" numberOfLines={1}>{e.title}</Text>
        <Text variant="body" tone="secondary" numberOfLines={1}>{meta}</Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>{[footerLeft, footerRight].filter(Boolean).join(' · ')}</Text>
      </View>
      <View style={styles.right}>
        {e.happeningNow ? <CrowdPill level={live?.crowd ?? null} /> : null}
        {e.isSponsored ? <Text variant="caption" tone="muted">Patrocinado</Text> : null}
        <DemoTag show={!!e.isDemo} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  selected: { backgroundColor: colors.surface },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  thumbImg: { width: 56, height: 56, aspectRatio: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  flex: { flex: 1, gap: 1 },
});
