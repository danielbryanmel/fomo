import type { Neighborhood } from '@/types/domain';

/** Bairros para busca manual (fallback quando a localização não é permitida). */
export const neighborhoods: Neighborhood[] = [
  { id: 'pinheiros', name: 'Pinheiros', center: { latitude: -23.5650, longitude: -46.6850 } },
  { id: 'vila-madalena', name: 'Vila Madalena', center: { latitude: -23.5550, longitude: -46.6900 } },
  { id: 'centro', name: 'Centro', center: { latitude: -23.5450, longitude: -46.6380 } },
  { id: 'consolacao', name: 'Consolação', center: { latitude: -23.5520, longitude: -46.6580 } },
  { id: 'liberdade', name: 'Liberdade', center: { latitude: -23.5590, longitude: -46.6350 } },
  { id: 'barra-funda', name: 'Barra Funda', center: { latitude: -23.5260, longitude: -46.6660 } },
];
