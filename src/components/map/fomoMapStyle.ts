/**
 * Estilo de mapa "Noite FOMO" para MapLibre (Web).
 * Tiles vetoriais gratuitos do OpenFreeMap (sem chave, sem limite de uso, dados OpenStreetMap).
 * Paleta derivada da marca: fundo preto #0A0A0C, ruas em violeta-grafite, água em roxo profundo,
 * nomes de bairro em caixa-alta discreta. O mapa é cenário — quem brilha são os rolês.
 */
import type { StyleSpecification } from 'maplibre-gl';

const SRC = 'openmaptiles';

const road = (color: string, w: [number, number, number, number]) => ({
  'line-color': color,
  'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, w[0], 13, w[1], 16, w[2], 19, w[3]],
});

export const FOMO_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: 'FOMO Noite',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    [SRC]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0A0A0C' } },
    {
      id: 'park', type: 'fill', source: SRC, 'source-layer': 'park',
      paint: { 'fill-color': '#0E0D13', 'fill-opacity': 0.9 },
    },
    {
      id: 'landcover', type: 'fill', source: SRC, 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood', 'forest']]],
      paint: { 'fill-color': '#0E0D12', 'fill-opacity': 0.7 },
    },
    {
      id: 'water', type: 'fill', source: SRC, 'source-layer': 'water',
      paint: { 'fill-color': '#120D1F' },
    },
    {
      id: 'waterway', type: 'line', source: SRC, 'source-layer': 'waterway',
      paint: { 'line-color': '#170F28', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 3] },
    },
    {
      id: 'building', type: 'fill', source: SRC, 'source-layer': 'building', minzoom: 14,
      paint: { 'fill-color': '#121017', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 0.85] },
    },
    {
      id: 'road-minor', type: 'line', source: SRC, 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'street', 'residential', 'living_street']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: road('#18151D', [0.2, 0.6, 3, 10]),
    },
    {
      id: 'road-mid', type: 'line', source: SRC, 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: road('#221D2A', [0.4, 1.1, 5, 16]),
    },
    {
      id: 'road-major', type: 'line', source: SRC, 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'trunk']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: road('#2B2434', [0.6, 1.6, 7, 20]),
    },
    {
      id: 'road-motorway', type: 'line', source: SRC, 'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: road('#35283F', [0.8, 2, 8, 22]),
    },
    {
      id: 'road-name', type: 'symbol', source: SRC, 'source-layer': 'transportation_name', minzoom: 15,
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'trunk', 'tertiary']]],
      layout: {
        'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'],
        'text-size': 10, 'text-letter-spacing': 0.05,
      },
      paint: { 'text-color': '#4A4453', 'text-halo-color': '#0A0A0C', 'text-halo-width': 1.2 },
    },
    {
      id: 'place-hood', type: 'symbol', source: SRC, 'source-layer': 'place', minzoom: 11.5,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter']]],
      layout: {
        'text-field': ['upcase', ['get', 'name']], 'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 15, 11], 'text-letter-spacing': 0.18,
        'text-max-width': 8, 'text-padding': 6,
      },
      paint: { 'text-color': '#5E5869', 'text-halo-color': '#0A0A0C', 'text-halo-width': 1.4 },
    },
    {
      id: 'place-city', type: 'symbol', source: SRC, 'source-layer': 'place', maxzoom: 11.5,
      filter: ['==', ['get', 'class'], 'city'],
      layout: {
        'text-field': ['upcase', ['get', 'name']], 'text-font': ['Noto Sans Bold'],
        'text-size': 12, 'text-letter-spacing': 0.25,
      },
      paint: { 'text-color': '#6E6879', 'text-halo-color': '#0A0A0C', 'text-halo-width': 1.4 },
    },
  ],
} as StyleSpecification;

export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>';
