import { Link } from 'expo-router';
import { DemoTag } from '@/components/ui/DemoTag';
import { Clock, MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Skeleton, Text } from '@/components/ui';
import { formatEventDate, formatPrice } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';
import type { EventView } from '@/types/domain';
import { CoverArt } from './CoverArt';

export function EventCard({ event }: { event: EventView }) {
  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${event.title}, ${formatEventDate(event.startsAt)}, ${formatPrice(event.priceMinCents, event.priceMaxCents)}`}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      >
        <CoverArt uri={event.coverUrl} seed={event.id} category={event.category.slug} rounded={0} />
        <View style={styles.body}>
          <View style={styles.metaRow}>
            <Text variant="mono" tone="accent">{event.category.name}</Text>
            {event.isSponsored ? <Text variant="mono" tone="muted">· patrocinado</Text> : null}
            <DemoTag show={!!event.isDemo} />
          </View>
          <Text variant="headline" numberOfLines={2}>{event.title}</Text>
          <View style={styles.line}>
            <Clock size={14} color={colors.textMuted} />
            <Text variant="caption" tone="secondary">{formatEventDate(event.startsAt)}</Text>
          </View>
          <View style={styles.line}>
            <MapPin size={14} color={colors.textMuted} />
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
              {event.venueName ?? 'Local a confirmar'}
            </Text>
            <Text variant="caption" tone="primary">{formatPrice(event.priceMinCents, event.priceMaxCents)}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={160} rounded={0} />
      <View style={styles.body}>
        <Skeleton width="25%" height={12} />
        <Skeleton width="70%" height={18} />
        <Skeleton width="45%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  body: { padding: spacing.lg, gap: spacing.xs + 2 },
  metaRow: { flexDirection: 'row', gap: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  flex: { flex: 1 },
});
