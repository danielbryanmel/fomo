import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarPlus, ExternalLink, MapPin, Navigation } from 'lucide-react-native';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { EventCard } from '@/components/event/EventCard';
import { Appear } from '@/components/motion';
import { Button, Screen, Skeleton, StateView, Text } from '@/components/ui';
import { VENUE_KIND } from '@/features/venues/labels';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';

/**
 * Página do lugar (bar, balada, casa de show). Dados cadastrados pela equipe com fonte;
 * lotação ao vivo só existe quando há um rolê acontecendo ali.
 */
export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const venue = useAsync(() => repositories.venues.getById(id), [id]);
  const events = useAsync(async () => (venue.data ? repositories.venues.upcomingEvents(venue.data) : []), [venue.data?.id]);
  const v = venue.data;

  if (venue.loading) return <Screen><Skeleton height={180} rounded={radius.lg} /></Screen>;
  if (!v) return <Screen><StateView title="Lugar não encontrado" actionLabel="Voltar" onAction={() => router.back()} /></Screen>;

  const maps = Platform.OS === 'ios'
    ? `http://maps.apple.com/?q=${encodeURIComponent(v.name)}&ll=${v.latitude},${v.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name}, ${v.address}`)}`;
  const checked = new Date(`${v.checkedAt}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');

  return (
    <Screen bleed edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <ScrollView contentContainerStyle={styles.pad}>
        <Appear style={{ gap: spacing.sm }}>
          <View style={styles.tag}><Text style={styles.tagText}>{VENUE_KIND[v.kind]}</Text></View>
          <Text variant="hero" accessibilityRole="header">{v.name}</Text>
          <View style={styles.row}>
            <MapPin size={16} color={colors.textSecondary} />
            <Text tone="secondary" style={{ flex: 1 }}>{v.address}</Text>
          </View>
          {v.geoPrecision === 'rua' ? <Text variant="caption" tone="muted">Ponto no mapa aproximado (pela rua).</Text> : null}
        </Appear>

        <View style={styles.actions}>
          <View style={{ flex: 1 }}><Button label="Como chegar" variant="secondary" icon={<Navigation size={16} color={colors.text} />} onPress={() => void Linking.openURL(maps)} fullWidth /></View>
          <View style={{ flex: 1 }}>
            <Button label="Sugerir rolê" icon={<CalendarPlus size={16} color={colors.background} />} fullWidth
              onPress={() => router.push({ pathname: '/suggest', params: { venueId: v.id } })} />
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="section">Próximos rolês aqui</Text>
          {events.loading ? <Skeleton height={120} rounded={radius.lg} /> : null}
          {!events.loading && !(events.data ?? []).length ? (
            <View style={styles.empty}>
              <Text tone="secondary">Nenhum rolê marcado aqui no FOMO ainda. Sabe de algum? Sugere que a moderação confere.</Text>
            </View>
          ) : null}
          {(events.data ?? []).map((e) => <EventCard key={e.id} event={e} />)}
        </View>

        <View style={styles.source}>
          <Text variant="caption" tone="muted">
            Lugar conferido em {checked}. Horário e programação mudam — confira nas redes da casa antes de ir.
          </Text>
          {v.sourceUrl ? (
            <Button label="Ver fonte" variant="ghost" icon={<ExternalLink size={14} color={colors.text} />} onPress={() => void Linking.openURL(v.sourceUrl!)} />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 80 },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.text, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 12, fontWeight: '800', color: colors.background },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  empty: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  source: { gap: spacing.xs, alignItems: 'flex-start' },
});
