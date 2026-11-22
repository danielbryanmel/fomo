/**
 * Mapa nativo (iOS/Android) com react-native-maps.
 * iOS: Apple Maps em modo escuro (sem chave). Android: Google Maps com estilo escuro
 * (Expo Go já traz chave; build de loja usa GOOGLE_MAPS_ANDROID_API_KEY via app.config.js).
 * A Web usa ExploreMap.web.tsx — este arquivo nunca entra no bundle Web.
 */
import { useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, type MapStyleElement } from 'react-native-maps';
import { MapPin } from './MapPin';
import type { ExploreMapProps } from './ExploreMap.types';

export type { ExploreMapHandle, ExploreMapProps } from './ExploreMap.types';

export function ExploreMap({
  ref,
  initialRegion,
  events,
  selectedId,
  onSelect,
  onRegionChangeComplete,
  userLocation,
  bottomInset,
  topInset,
}: ExploreMapProps) {
  const mapRef = useRef<MapView>(null);
  // Markers com view customizada: só re-renderizam quando a seleção muda (performance).
  const [tracking, setTracking] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    animateTo: (region) => mapRef.current?.animateToRegion(region, 450),
  }));

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      onRegionChangeComplete={(r) => onRegionChangeComplete(r)}
      onPress={() => onSelect(null)}
      showsUserLocation={!!userLocation}
      showsMyLocationButton={false}
      showsCompass={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      pitchEnabled={false}
      userInterfaceStyle="dark"
      customMapStyle={DARK_STYLE}
      mapPadding={{ top: topInset, bottom: bottomInset, left: 0, right: 0 }}
      accessibilityLabel="Mapa de eventos"
    >
      {events.map((e) => {
        const selected = e.id === selectedId;
        return (
          <Marker
            key={e.id}
            identifier={e.id}
            coordinate={{ latitude: e.latitude, longitude: e.longitude }}
            anchor={{ x: 0.08, y: 0.5 }}
            tracksViewChanges={tracking === e.id || selected}
            stopPropagation
            onPress={() => {
              setTracking(e.id);
              onSelect(e.id);
              setTimeout(() => setTracking(null), 500);
            }}
            accessibilityLabel={`${e.title}${e.live?.crowd ? `, lotação ${e.live.crowd} de 4` : ''}`}
          >
            <MapPin event={e} selected={selected} />
          </Marker>
        );
      })}
    </MapView>
  );
}

/** Estilo escuro discreto (Google Maps/Android). Ruas visíveis, POIs e rótulos de negócios ocultos. */
const DARK_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#121116' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7e7c86' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f1d25' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#26232d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2e2a36' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b0a12' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
];
