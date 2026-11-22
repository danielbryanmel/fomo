import { Pressable, StyleSheet, View } from 'react-native';
import { DemoTag } from '@/components/ui/DemoTag';
import { Text } from '@/components/ui/Text';
import { CROWD_LABEL, MUSIC_LABEL, VIBE_LABEL } from '@/config/live';
import { formatDistance } from '@/lib/geo';
import { formatEventDate, formatPrice, formatRelative } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';
import type { MapEvent } from '@/types/domain';
import { CrowdPill } from './CrowdPill';
import { HeatMeter } from './HeatMeter';

type Props = { event: MapEvent; selected?: boolean; onPress: () => void };

/** Linha da lista "Onde tá bom agora": nome, metadados mono, medidor e frescor do dado. */
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
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="headline" numberOfLines={1}>{e.title}</Text>
          <Text variant="mono" tone="muted" numberOfLines={1}>{meta}</Text>
        </View>
        {e.happeningNow ? <CrowdPill level={live?.crowd ?? null} /> : null}
        {e.isSponsored ? <Text variant="mono" tone="muted">patrocinado</Text> : null}
        <DemoTag show={!!e.isDemo} />
      </View>
      {e.happeningNow ? <HeatMeter level={live?.crowd ?? null} /> : null}
      <View style={styles.foot}>
        <Text variant="mono" tone="secondary" numberOfLines={1} style={styles.flex}>{footerLeft}</Text>
        <Text variant="mono" tone="muted">{footerRight}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.accentPink },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  foot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
