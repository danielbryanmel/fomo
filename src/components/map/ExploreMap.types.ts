import type { Ref } from 'react';
import type { Region } from '@/lib/geo';
import type { GeoPoint, MapEvent, Venue } from '@/types/domain';

export type ExploreMapHandle = {
  animateTo: (region: Region) => void;
};

export type ExploreMapProps = {
  ref?: Ref<ExploreMapHandle>;
  initialRegion: Region;
  events: MapEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Disparado ao terminar um movimento (debounce fica a cargo de quem consome). */
  onRegionChangeComplete: (region: Region) => void;
  /** Lugares reais (sem lotação): pinos discretos que levam à página do lugar. */
  venues?: Venue[];
  onVenuePress?: (id: string) => void;
  userLocation: GeoPoint | null;
  /** Raio de incerteza da localização (m). Mostrado como círculo no mapa. */
  userAccuracyM?: number | null;
  /** Espaço ocupado embaixo (bottom sheet) para centralizar pins acima dele. */
  bottomInset: number;
  topInset: number;
};
