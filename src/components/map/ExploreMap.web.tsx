/**
 * Mapa Web real e GRATUITO: Leaflet + tiles do OpenStreetMap (sem chave, sem cobrança).
 * - Tema escuro aplicado por filtro CSS nos tiles (mantém a identidade preta do FOMO).
 * - Pins desenhados em HTML com a mesma linguagem do MapPin nativo.
 * - Política de uso do OSM: atribuição visível e uso leve (ok para beta com amigos).
 *   Para escalar, trocar a URL de tiles por um provedor com plano gratuito maior.
 * O app nativo continua usando react-native-maps (ExploreMap.tsx).
 */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Region } from '@/lib/geo';
import { colors, radius, spacing } from '@/theme';
import type { MapEvent } from '@/types/domain';
import type { ExploreMapProps } from './ExploreMap.types';

export type { ExploreMapHandle, ExploreMapProps } from './ExploreMap.types';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const STYLE_ID = 'fomo-leaflet-style';
function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    .fomo-map { background: ${colors.background}; }
    .fomo-map .leaflet-tile-pane { filter: invert(1) hue-rotate(200deg) brightness(0.78) contrast(0.92) saturate(0.35); }
    .fomo-map .leaflet-control-attribution { background: rgba(10,10,12,0.7); color: #8d8a96; font-size: 10px; border-radius: 6px; margin: var(--fomo-top, 120px) 0 0 16px !important; }
    .fomo-map .leaflet-control-attribution a { color: #c9c6d2; }
    .fomo-pin { background: none; border: none; }
    .fomo-pin-wrap { display: flex; align-items: center; gap: 4px; transform: translate(-50%, -50%); width: max-content; cursor: pointer; }
    .fomo-pin-box { position: relative; display: flex; align-items: center; justify-content: center; }
    .fomo-pin-halo { position: absolute; border-radius: 999px; opacity: .25; animation: fomoPulse 2.2s ease-out infinite; }
    .fomo-pin-dot { border-radius: 999px; box-sizing: border-box; transition: transform .18s ease; }
    .fomo-pin-wrap:hover .fomo-pin-dot { transform: scale(1.15); }
    .fomo-pin-label { max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 3px 8px;
      border-radius: 8px; background: rgba(10,10,12,.82); color: #fff; font: 600 11px/1.3 -apple-system, system-ui, sans-serif; }
    .fomo-pin-label.sel { border: 1px solid rgba(255,255,255,.22); }
    .fomo-user { width: 16px; height: 16px; border-radius: 50%; background: #4C8DFF; border: 3px solid #fff; box-sizing: border-box;
      box-shadow: 0 0 0 6px rgba(76,141,255,.25); transform: translate(-50%, -50%); }
    @keyframes fomoPulse { 0% { transform: scale(.7); opacity: .35 } 100% { transform: scale(1.25); opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .fomo-pin-halo { animation: none; } }
  `;
  document.head.appendChild(el);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Mesmo desenho do MapPin nativo, em HTML. */
function pinHtml(e: MapEvent, selected: boolean) {
  const level = e.live?.crowd ?? null;
  const now = e.happeningNow;
  const color = level ? colors.heat[level] : now ? colors.text : colors.textSecondary;
  const size = selected ? 18 : level ? 12 + level : 11;
  const halo = level ? size + 8 + level * 3 : 0;
  const box = Math.max(halo, size);
  const dot = `width:${size}px;height:${size}px;background:${now ? color : colors.background};border:${now ? (selected ? 2.5 : 1.5) : 2.5}px solid ${now ? (selected ? colors.text : 'rgba(0,0,0,.5)') : color};`;
  const label = selected || (level ?? 0) >= 3 ? `<div class="fomo-pin-label${selected ? ' sel' : ''}">${esc(e.venueName ?? e.title)}</div>` : '';
  return `<div class="fomo-pin-wrap" style="margin-left:${box / 2}px"><div class="fomo-pin-box" style="width:${box}px;height:${box}px">${
    level ? `<div class="fomo-pin-halo" style="width:${halo}px;height:${halo}px;background:${color}"></div>` : ''
  }<div class="fomo-pin-dot" style="${dot}"></div></div>${label}</div>`;
}

function regionOf(map: L.Map): Region {
  const b = map.getBounds();
  const c = b.getCenter();
  return { latitude: c.lat, longitude: c.lng, latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest() };
}

export function ExploreMap({ ref, initialRegion, events, selectedId, onSelect, onRegionChangeComplete, userLocation, bottomInset, topInset }: ExploreMapProps) {
  const host = useRef<HTMLElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const userMarker = useRef<L.Marker | null>(null);
  const cb = useRef({ onSelect, onRegionChangeComplete });
  cb.current = { onSelect, onRegionChangeComplete };
  const insets = useRef({ top: topInset, bottom: bottomInset });
  insets.current = { top: topInset, bottom: bottomInset };

  const fit = (r: Region, animate: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = L.latLngBounds(
      [r.latitude - r.latitudeDelta / 2, r.longitude - r.longitudeDelta / 2],
      [r.latitude + r.latitudeDelta / 2, r.longitude + r.longitudeDelta / 2],
    );
    map.fitBounds(bounds, { paddingTopLeft: [0, insets.current.top], paddingBottomRight: [0, insets.current.bottom], animate });
  };

  useImperativeHandle(ref, () => ({ animateTo: (r) => fit(r, true) }));

  // cria o mapa uma vez
  useEffect(() => {
    injectStyle();
    const el = host.current;
    if (!el || mapRef.current) return;
    el.classList.add('fomo-map');
    el.style.setProperty('--fomo-top', `${insets.current.top + 8}px`);
    const map = L.map(el, { zoomControl: false, attributionControl: false, minZoom: 10, maxZoom: 18, worldCopyJump: false });
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19, crossOrigin: true }).addTo(map);
    // atribuição obrigatória do OSM: no topo, logo abaixo dos filtros (o bottom sheet cobriria o rodapé)
    L.control.attribution({ position: 'topleft', prefix: false }).addTo(map);
    mapRef.current = map;
    fit(initialRegion, false);
    map.on('moveend', () => cb.current.onRegionChangeComplete(regionOf(map)));
    map.on('click', () => cb.current.onSelect(null));
    // o container pode mudar de tamanho (layout RN)
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const e of events) {
      seen.add(e.id);
      const sel = e.id === selectedId;
      const icon = L.divIcon({ className: 'fomo-pin', html: pinHtml(e, sel), iconSize: [0, 0] });
      let m = markers.current.get(e.id);
      if (!m) {
        m = L.marker([e.latitude, e.longitude], { icon, keyboard: true, title: e.title, riseOnHover: true });
        m.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          cb.current.onSelect(e.id);
        });
        m.addTo(map);
        markers.current.set(e.id, m);
      } else {
        m.setLatLng([e.latitude, e.longitude]);
        m.setIcon(icon);
      }
      m.setZIndexOffset(sel ? 1000 : (e.live?.crowd ?? 0) * 10);
    }
    for (const [id, m] of markers.current) {
      if (!seen.has(id)) {
        m.remove();
        markers.current.delete(id);
      }
    }
  }, [events, selectedId]);

  // localização do usuário
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    const ll: L.LatLngExpression = [userLocation.latitude, userLocation.longitude];
    if (!userMarker.current) {
      userMarker.current = L.marker(ll, { icon: L.divIcon({ className: 'fomo-pin', html: '<div class="fomo-user"></div>', iconSize: [0, 0] }), interactive: false, zIndexOffset: 2000 }).addTo(map);
    } else userMarker.current.setLatLng(ll);
  }, [userLocation]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View ref={host as never} style={StyleSheet.absoluteFill} accessibilityLabel="Mapa dos rolês" />
      <View style={[styles.zoom, { top: topInset + spacing.md }]}>
        <Pressable onPress={() => mapRef.current?.zoomIn()} style={styles.zoomBtn} accessibilityRole="button" accessibilityLabel="Aproximar">
          <Plus size={18} color={colors.text} />
        </Pressable>
        <View style={styles.zoomSep} />
        <Pressable onPress={() => mapRef.current?.zoomOut()} style={styles.zoomBtn} accessibilityRole="button" accessibilityLabel="Afastar">
          <Minus size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zoom: { position: 'absolute', right: spacing.lg, zIndex: 500, borderRadius: radius.md, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  zoomBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  zoomSep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
