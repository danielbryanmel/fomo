import { useAppSize } from '@/components/web/WebFrame';
import { Appear } from '@/components/motion';
import BottomSheet, { BottomSheetFlatList, type BottomSheetFlatListMethods } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { ChevronDown, ChevronRight, LocateFixed, MapPin, Search, SearchX, SlidersHorizontal, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FomoLockup } from '@/components/brand/FomoLockup';
import { LiveEventRow } from '@/components/live/LiveEventRow';
import { ExploreMap, type ExploreMapHandle } from '@/components/map/ExploreMap';
import { Button, Chip, IconButton, LiveDot, StateView, Text } from '@/components/ui';
import { activeFilterCount, FilterSheet } from '@/features/explore/FilterSheet';
import { PlacePicker } from '@/features/explore/PlacePicker';
import { useExploreMap } from '@/features/explore/useExploreMap';
import { useLocation } from '@/features/location/useLocation';
import { useAsync } from '@/hooks/useAsync';
import { VENUE_KIND } from '@/features/venues/labels';
import { DEFAULT_REGION, formatDistance, regionAround, regionToBounds } from '@/lib/geo';
import { repositories } from '@/repositories';
import { colors, hitTarget, radius, spacing, TAB_BAR_SPACE, typography } from '@/theme';
import type { MapEvent, Venue } from '@/types/domain';

const SNAPS = ['22%', '50%', '86%'];
const SNAP_RATIO = [0.22, 0.5, 0.86];

function VenuesNearby({ venues }: { venues: Venue[] }) {
  return (
    <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="section">Lugares por aqui</Text>
        <Text variant="caption" tone="muted">{venues.length} {venues.length === 1 ? 'lugar' : 'lugares'}</Text>
      </View>
      {venues.slice(0, 20).map((v) => (
        <Pressable
          key={v.id}
          onPress={() => router.push({ pathname: '/venue/[id]', params: { id: v.id } })}
          accessibilityRole="link"
          style={({ pressed }) => [styles.venueRow, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.venueIcon}><MapPin size={18} color={colors.textSecondary} /></View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>{v.name}</Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {[VENUE_KIND[v.kind], v.neighborhood, formatDistance(v.distanceM ?? null)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useAppSize();
  const mapRef = useRef<ExploreMapHandle>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const listRef = useRef<BottomSheetFlatListMethods>(null);

  const location = useLocation();
  const initialRegion = useMemo(
    () => (location.neighborhood ? regionAround(location.neighborhood.center) : DEFAULT_REGION),
    // região inicial só é lida uma vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const explore = useExploreMap(initialRegion, location.origin);
  // lugares reais da área visível (bares, baladas, casas de show) — só leitura
  const [venues, setVenues] = useState<Venue[]>([]);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      repositories.venues.inBounds(regionToBounds(explore.region), location.origin)
        .then((v) => { if (alive) setVenues(v); })
        .catch(() => {});
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [explore.region, location.origin]);
  const categories = useAsync(() => repositories.events.listCategories(), []);
  const neighborhoods = useAsync(() => repositories.events.listNeighborhoods(), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => explore.setQuery(searchInput), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const topOverlayH = insets.top + 112;
  const barSpace = TAB_BAR_SPACE - spacing.md + Math.max(insets.bottom - spacing.md, 0);
  const sheetH = (height - barSpace) * (SNAP_RATIO[sheetIndex] ?? 0.22) + barSpace;

  const selected = explore.events.find((e) => e.id === selectedId) ?? null;
  const ordered = useMemo(() => {
    if (!selected) return explore.events;
    return [selected, ...explore.events.filter((e) => e.id !== selected.id)];
  }, [explore.events, selected]);

  function selectEvent(id: string | null) {
    setSelectedId(id);
    if (id) {
      if (sheetIndex === 0) sheetRef.current?.snapToIndex(1);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }

  async function useMyLocation() {
    setPlaceOpen(false);
    await location.setNeighborhood(null);
    const p = await location.request();
    if (p) mapRef.current?.animateTo(regionAround(p));
  }

  const placeLabel = location.neighborhood?.name ?? (location.position ? 'Perto de você' : 'São Paulo');
  const filterCount = activeFilterCount(explore.filters);
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const anyLive = explore.events.some((e) => e.happeningNow);

  const header = (
    <View style={styles.sheetHeader}>
      <View style={styles.liveLine}>
        {explore.liveCount > 0 ? <LiveDot /> : null}
        <Text variant="mono" tone={explore.liveCount > 0 ? 'live' : 'muted'}>
          {explore.liveCount > 0 ? `${explore.liveCount} ${explore.liveCount === 1 ? 'lugar bombando' : 'lugares bombando'} · ${clock}` : `${explore.events.length} rolês nesta área · ${clock}`}
        </Text>
        {explore.loading ? <ActivityIndicator size="small" color={colors.textMuted} style={styles.spinner} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="title" style={{ fontSize: 24, lineHeight: 29, flex: 1 }}>{anyLive ? 'Agora perto de você' : 'Próximos rolês'}</Text>
        <Text variant="body" tone="secondary">{explore.events.length} {explore.events.length === 1 ? 'rolê' : 'rolês'}</Text>
      </View>

      {location.status === 'prompt' && !location.neighborhood ? (
        <View style={styles.locCard}>
          <Text variant="caption" tone="secondary" style={styles.flex}>
            Ver distâncias e o que está perto? Usamos sua localização só agora, uma vez.
          </Text>
          <Button label="Permitir" variant="secondary" onPress={useMyLocation} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <ExploreMap
        ref={mapRef}
        initialRegion={initialRegion}
        events={explore.events}
        selectedId={selectedId}
        onSelect={selectEvent}
        onRegionChangeComplete={explore.setRegion}
        venues={venues}
        onVenuePress={(id) => router.push({ pathname: '/venue/[id]', params: { id } })}
        userLocation={location.neighborhood ? null : location.position}
        userAccuracyM={location.neighborhood ? null : location.accuracyM}
        topInset={topOverlayH}
        bottomInset={sheetH}
      />

      {/* Topo: marca, região, busca e filtros */}
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          {searchOpen ? (
            <View style={styles.search}>
              <Search size={18} color={colors.textMuted} />
              <TextInput
                autoFocus
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Nome do lugar, festa ou rua"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                returnKeyType="search"
                accessibilityLabel="Buscar no mapa"
              />
              <IconButton label="Fechar busca" icon={<X size={18} color={colors.textSecondary} />} onPress={() => { setSearchOpen(false); setSearchInput(''); }} />
            </View>
          ) : (
            <>
              <FomoLockup size={22} />
              <View style={styles.flex} />
              <Pressable onPress={() => setPlaceOpen(true)} style={styles.placePill} accessibilityRole="button" accessibilityLabel={`Região: ${placeLabel}. Alterar`}>
                <Text variant="mono" style={{ fontWeight: '700' }}>{placeLabel}</Text>
                <ChevronDown size={14} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => setSearchOpen(true)} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Buscar">
                <Search size={18} color={colors.text} />
              </Pressable>
            </>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => setFiltersOpen(true)} style={[styles.filterBtn, filterCount > 0 && styles.filterBtnOn]} accessibilityRole="button" accessibilityLabel={`Filtros${filterCount ? `, ${filterCount} ativos` : ''}`}>
            <SlidersHorizontal size={16} color={colors.text} />
            {filterCount ? <Text variant="label">{filterCount}</Text> : null}
          </Pressable>
          <Chip label="Tudo" selected={explore.category === null} onPress={() => explore.setCategory(null)} />
          {(categories.data ?? []).map((c) => (
            <Chip key={c.id} label={c.name} selected={explore.category === c.slug} onPress={() => explore.setCategory(c.slug)} />
          ))}
        </ScrollView>
      </View>

      {/* Localização imprecisa (comum no computador ou com GPS desligado): avisa com honestidade */}
      {!location.neighborhood && location.position && (location.accuracyM ?? 0) > 300 ? (
        <Appear kind="fade" style={[styles.accuracy, { bottom: sheetH + spacing.md + 6 }]}>
          <Text variant="mono" tone="secondary" style={{ fontSize: 11 }}>
            precisão ~{(location.accuracyM ?? 0) >= 1000 ? `${((location.accuracyM ?? 0) / 1000).toFixed(1).replace('.', ',')} km` : `${location.accuracyM} m`} · ative o GPS
          </Text>
        </Appear>
      ) : null}

      {/* Centralizar na minha localização */}
      <Pressable
        onPress={async () => {
          // mostra a última posição já, e refina com uma leitura nova (precisão alta)
          if (location.position) mapRef.current?.animateTo(regionAround(location.position, 0.02));
          const p = await location.request();
          if (p) {
            await location.setNeighborhood(null);
            mapRef.current?.animateTo(regionAround(p, 0.02));
          } else if (!location.position) setPlaceOpen(true);
        }}
        style={[styles.locate, { bottom: sheetH + spacing.md }]}
        accessibilityRole="button"
        accessibilityLabel="Centralizar na minha localização"
      >
        <LocateFixed size={20} color={colors.text} />
      </Pressable>

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={SNAPS}
        onChange={(i) => setSheetIndex(Math.max(0, i))}
        bottomInset={barSpace}
        style={styles.sheet}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
        enableDynamicSizing={false}
      >
        <BottomSheetFlatList<MapEvent>
          ref={listRef}
          data={ordered}
          keyExtractor={(e: MapEvent) => e.id}
          ListHeaderComponent={header}
          renderItem={({ item, index }: { item: MapEvent; index: number }) => (
            <Appear index={index}>
              <LiveEventRow
                event={item}
                selected={item.id === selectedId}
                onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id } })}
              />
            </Appear>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          ListFooterComponent={venues.length ? <VenuesNearby venues={venues} /> : undefined}
          contentContainerStyle={[styles.list, { paddingBottom: spacing.xxl }]}
          ListEmptyComponent={
            explore.loading ? undefined : explore.error ? (
              <StateView tone="error" title="Não deu para carregar o mapa" description="Verifique a conexão." actionLabel="Tentar de novo" onAction={explore.retry} />
            ) : (
              <StateView
                icon={<SearchX size={24} color={colors.textSecondary} />}
                title="Nada nesta área"
                description={explore.query ? `Nada para "${explore.query}".` : 'Afaste o mapa, troque de bairro ou ajuste os filtros.'}
                actionLabel={filterCount ? 'Limpar filtros' : undefined}
                onAction={filterCount ? () => explore.setFilters({ date: 'any', maxDistanceKm: null, price: 'any' }) : undefined}
              />
            )
          }
        />
      </BottomSheet>

      <FilterSheet visible={filtersOpen} value={explore.filters} hasOrigin={!!location.origin} onChange={explore.setFilters} onClose={() => setFiltersOpen(false)} />
      <PlacePicker
        visible={placeOpen}
        neighborhoods={neighborhoods.data ?? []}
        current={location.neighborhood}
        locationStatus={location.status}
        onUseLocation={useMyLocation}
        onPick={async (n) => {
          setPlaceOpen(false);
          await location.setNeighborhood(n);
          mapRef.current?.animateTo(regionAround(n.center));
        }}
        onClose={() => setPlaceOpen(false)}
      />
    </View>
  );
}

const glass = {
  backgroundColor: colors.glass,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
} as const;

const styles = StyleSheet.create({
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  venueIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  accuracy: { position: 'absolute', right: 72, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(10,10,11,0.82)', borderWidth: 1, borderColor: colors.border },
  root: { flex: 1, backgroundColor: colors.background },
  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 44 },
  flex: { flex: 1 },
  placePill: { ...glass, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, height: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  roundBtn: { ...glass, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  search: { ...glass, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, borderRadius: radius.pill, height: hitTarget },
  input: { flex: 1, color: colors.text, fontSize: typography.body.fontSize },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  filterBtn: { ...glass, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  filterBtnOn: { borderColor: colors.accentPink },
  locate: { ...glass, position: 'absolute', right: spacing.lg, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheet: { marginHorizontal: 0 },
  sheetBg: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  handle: { backgroundColor: colors.borderStrong, width: 36 },
  sheetHeader: { gap: spacing.xs, paddingBottom: spacing.lg },
  liveLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spinner: { marginLeft: 'auto' },
  locCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  list: { paddingHorizontal: spacing.lg },
});
