/**
 * Mapa Web: MapLibre GL + tiles vetoriais gratuitos do OpenFreeMap, com o estilo "Noite FOMO"
 * (fomoMapStyle.ts). Sem chave, sem cobrança, sem limite de uso.
 *
 * Camadas, de baixo para cima:
 *  1. cidade em violeta-grafite (cenário, quase invisível);
 *  2. "calor da noite": heatmap dos rolês acontecendo agora, pesado pela lotação, que respira devagar;
 *  3. pins (mesmo desenho do MapPin nativo) com entrada animada;
 *  4. você: ponto azul + círculo de precisão.
 * O app nativo usa react-native-maps (ExploreMap.tsx).
 */
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl, { type GeoJSONSource, type Map as MLMap, type Marker } from 'maplibre-gl';
import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Region } from '@/lib/geo';
import { CROWD_LABEL } from '@/config/live';
import { colors, heatScale, radius, spacing } from '@/theme';
import type { GeoPoint, MapEvent } from '@/types/domain';
import type { ExploreMapProps } from './ExploreMap.types';
import { FOMO_MAP_STYLE, MAP_ATTRIBUTION } from './fomoMapStyle';

export type { ExploreMapHandle, ExploreMapProps } from './ExploreMap.types';

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const STYLE_ID = 'fomo-map-style';
function injectCss() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    .fomo-map { background: ${colors.background}; }
    .fomo-map .maplibregl-ctrl-attrib { background: rgba(10,10,11,.72) !important; color: #6f6a78; font-size: 10px; }
    .fomo-map .maplibregl-ctrl-attrib a { color: #a29cad; }
    .fomo-map .maplibregl-ctrl-attrib-button { filter: invert(1) opacity(.55); }
    .fomo-map .maplibregl-ctrl-top-left { margin-top: var(--fomo-top, 120px); }
    .fomo-pin-wrap { display: flex; align-items: center; gap: 5px; cursor: pointer; transform-origin: 12px 50%;
      animation: fomoPinIn .5s cubic-bezier(.2,1.4,.4,1) both; -webkit-tap-highlight-color: transparent; }
    .fomo-pin-box { position: relative; display: flex; align-items: center; justify-content: center; flex: none; }
    .fomo-pin-halo { position: absolute; border-radius: 999px; animation: fomoPulse 2.4s ease-out infinite; }
    .fomo-pin-dot { border-radius: 999px; box-sizing: border-box; transition: transform .25s cubic-bezier(.2,1.4,.4,1); }
    .fomo-pin-wrap:hover .fomo-pin-dot { transform: scale(1.2); }
    .fomo-pin-label { max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 4px 9px;
      border-radius: 8px; background: rgba(21,20,23,.92); color: #F4F1F6; font: 700 13px/1.25 Archivo-Bold, Archivo, system-ui, sans-serif;
      animation: fomoLabelIn .3s ease both; }
    .fomo-pin-label.sel { border-color: rgba(255,255,255,.28); }
    .fomo-user { position: relative; width: 18px; height: 18px; }
    .fomo-user::before { content: ''; position: absolute; inset: -10px; border-radius: 50%; background: rgba(244,241,246,.16); animation: fomoPulse 2.2s ease-out infinite; }
    .fomo-user::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: #F4F1F6; border: 5px solid #0A0A0B; box-sizing: border-box; box-shadow: 0 2px 10px rgba(0,0,0,.5); }
    @keyframes fomoPinIn { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
    @keyframes fomoLabelIn { from { transform: translateX(-6px); opacity: 0 } to { transform: none; opacity: 1 } }
    @keyframes fomoPulse { 0% { transform: scale(.6); opacity: .5 } 100% { transform: scale(1.5); opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .fomo-pin-wrap, .fomo-pin-label { animation: none } .fomo-pin-halo, .fomo-user::before { animation: none; opacity: .25 } }
  `;
  document.head.appendChild(el);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Pin (redesign): ponto na cor fixa do termômetro + etiqueta "Nome  Status". Só "Lotado" pulsa (limão = verdadeiro agora). */
function pinHtml(e: MapEvent, selected: boolean) {
  const level = e.live?.crowd ?? null;
  const now = e.happeningNow;
  const color = level ? heatScale[level].dot : now ? colors.text : colors.textMuted;
  const size = selected ? 20 : 16;
  const box = Math.max(size, 24);
  const dot = `width:${size}px;height:${size}px;background:${now ? color : colors.background};border:${now ? (selected ? 3 : 0) : 2.5}px solid ${
    now ? colors.text : color
  };`;
  const status = level ? ` <b style="color:${level === 1 ? colors.textSecondary : heatScale[level].dot};font-weight:800">${CROWD_LABEL[level]}</b>` : '';
  const label = selected || level || (!e.isDemo && !now) ? `<div class="fomo-pin-label${selected ? ' sel' : ''}">${esc(e.venueName ?? e.title)}${status}</div>` : '';
  return `<div class="fomo-pin-box" style="width:${box}px;height:${box}px">${
    level === 4 ? `<div class="fomo-pin-halo" style="width:${size + 14}px;height:${size + 14}px;background:${color}"></div>` : ''
  }<div class="fomo-pin-dot" style="${dot}"></div></div>${label}`;
}

function regionOf(map: MLMap): Region {
  const b = map.getBounds();
  const c = b.getCenter();
  return { latitude: c.lat, longitude: c.lng, latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest() };
}

function heatData(events: MapEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events
      .filter((e) => e.happeningNow && e.live?.crowd)
      .map((e) => ({ type: 'Feature', properties: { w: (e.live!.crowd ?? 0) / 4 }, geometry: { type: 'Point', coordinates: [e.longitude, e.latitude] } })),
  };
}

/** Círculo aproximado (64 lados) para o raio de precisão. */
function circle(p: GeoPoint, meters: number): GeoJSON.FeatureCollection {
  const pts: [number, number][] = [];
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((p.latitude * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    pts.push([p.longitude + dLng * Math.cos(a), p.latitude + dLat * Math.sin(a)]);
  }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } }] };
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function ExploreMap({ ref, initialRegion, events, selectedId, onSelect, onRegionChangeComplete, userLocation, userAccuracyM, bottomInset, topInset }: ExploreMapProps) {
  const host = useRef<HTMLElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const markers = useRef(new Map<string, { m: Marker; key: string }>());
  const userMarker = useRef<Marker | null>(null);
  const latest = useRef({ events, selectedId, userLocation, userAccuracyM });
  latest.current = { events, selectedId, userLocation, userAccuracyM };
  const cb = useRef({ onSelect, onRegionChangeComplete });
  cb.current = { onSelect, onRegionChangeComplete };
  const insets = useRef({ top: topInset, bottom: bottomInset });
  insets.current = { top: topInset, bottom: bottomInset };

  const pad = () => ({ top: insets.current.top, bottom: insets.current.bottom, left: 0, right: 0 });

  const fit = (r: Region, animate: boolean) => {
    mapRef.current?.fitBounds(
      [[r.longitude - r.longitudeDelta / 2, r.latitude - r.latitudeDelta / 2], [r.longitude + r.longitudeDelta / 2, r.latitude + r.latitudeDelta / 2]],
      { padding: pad(), animate: animate && !reduceMotion(), duration: 900 },
    );
  };

  useImperativeHandle(ref, () => ({ animateTo: (r) => fit(r, true) }));

  /** Esconde etiquetas que se sobrepõem (fica a de maior prioridade: selecionado > lotação). O ponto continua visível. */
  const declutter = () => {
    const items = [...markers.current.values()]
      .map((v) => ({ el: v.m.getElement(), z: Number(v.m.getElement().style.zIndex || 0) }))
      .sort((a, b) => b.z - a.z);
    const taken: DOMRect[] = [];
    for (const it of items) {
      const lab = it.el.querySelector('.fomo-pin-label') as HTMLElement | null;
      if (!lab) continue;
      lab.style.visibility = 'visible';
      const r = lab.getBoundingClientRect();
      const hit = taken.some((t) => !(r.right < t.left - 2 || r.left > t.right + 2 || r.bottom < t.top - 2 || r.top > t.bottom + 2));
      if (hit && it.z < 50) lab.style.visibility = 'hidden';
      else taken.push(r);
    }
  };

  const syncPins = () => {
    const map = mapRef.current;
    if (!map) return;
    const { events: evs, selectedId: sel } = latest.current;
    const seen = new Set<string>();
    for (const e of evs) {
      seen.add(e.id);
      const isSel = e.id === sel;
      const key = `${isSel}|${e.live?.crowd ?? 0}|${e.happeningNow}|${e.venueName ?? e.title}`;
      const z = isSel ? '50' : String(e.live?.crowd ?? 0);
      const cur = markers.current.get(e.id);
      if (cur) {
        cur.m.setLngLat([e.longitude, e.latitude]);
        if (cur.key !== key) {
          (cur.m.getElement().firstElementChild as HTMLElement).innerHTML = pinHtml(e, isSel);
          cur.key = key;
        }
        cur.m.getElement().style.zIndex = z;
        continue;
      }
      const el = document.createElement('div');
      const inner = document.createElement('div');
      inner.className = 'fomo-pin-wrap';
      inner.style.animationDelay = `${Math.min(markers.current.size, 12) * 35}ms`;
      inner.innerHTML = pinHtml(e, isSel);
      inner.setAttribute('role', 'button');
      inner.setAttribute('aria-label', `${e.title}${e.live?.crowd ? `, lotação ${e.live.crowd} de 4` : ''}`);
      el.appendChild(inner);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        cb.current.onSelect(e.id);
      });
      // âncora no centro do ponto; o rótulo cresce para a direita
      const m = new maplibregl.Marker({ element: el, anchor: 'left', offset: [-12, 0] }).setLngLat([e.longitude, e.latitude]).addTo(map);
      el.style.zIndex = z;
      markers.current.set(e.id, { m, key });
    }
    requestAnimationFrame(declutter);
    for (const [id, v] of markers.current) {
      if (!seen.has(id)) {
        v.m.remove();
        markers.current.delete(id);
      }
    }
    if (ready.current) (map.getSource('heat') as GeoJSONSource | undefined)?.setData(heatData(evs));
  };

  const syncUser = () => {
    const map = mapRef.current;
    if (!map) return;
    const { userLocation: u, userAccuracyM: acc } = latest.current;
    if (!u) {
      userMarker.current?.remove();
      userMarker.current = null;
      if (ready.current) (map.getSource('accuracy') as GeoJSONSource | undefined)?.setData(EMPTY);
      return;
    }
    if (!userMarker.current) {
      const el = document.createElement('div');
      el.className = 'fomo-user';
      el.setAttribute('aria-label', 'Você está aqui');
      userMarker.current = new maplibregl.Marker({ element: el }).setLngLat([u.longitude, u.latitude]).addTo(map);
    } else userMarker.current.setLngLat([u.longitude, u.latitude]);
    if (ready.current) (map.getSource('accuracy') as GeoJSONSource | undefined)?.setData(acc && acc > 25 ? circle(u, Math.min(acc, 5000)) : EMPTY);
  };

  useEffect(() => {
    injectCss();
    const outer = host.current;
    if (!outer || mapRef.current) return;
    // o CSS do MapLibre força position:relative no container — usamos uma div interna
    // para não quebrar o absoluteFill do React Native Web (altura 0).
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;';
    outer.appendChild(el);
    el.classList.add('fomo-map');
    el.style.setProperty('--fomo-top', `${insets.current.top + 4}px`);
    const r = initialRegion;
    const map = new maplibregl.Map({
      container: el,
      style: FOMO_MAP_STYLE,
      bounds: [[r.longitude - r.longitudeDelta / 2, r.latitude - r.latitudeDelta / 2], [r.longitude + r.longitudeDelta / 2, r.latitude + r.latitudeDelta / 2]],
      fitBoundsOptions: { padding: pad() },
      minZoom: 9,
      maxZoom: 18,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 200,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }), 'top-left');
    // atribuição obrigatória, mas recolhida no botão (i) para não cobrir os pins
    const collapseAttrib = () => {
      const a = el.querySelector('.maplibregl-ctrl-attrib');
      a?.classList.remove('maplibregl-compact-show');
      a?.removeAttribute('open');
    };
    map.once('idle', collapseAttrib);
    setTimeout(collapseAttrib, 600);
    mapRef.current = map;

    let raf = 0;
    map.on('load', () => {
      map.addSource('heat', { type: 'geojson', data: heatData(latest.current.events) });
      map.addLayer({
        id: 'heat',
        type: 'heatmap',
        source: 'heat',
        layout: { visibility: 'none' }, // redesign: sem degradê no mapa
        paint: {
          'heatmap-weight': ['get', 'w'],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 28, 13, 60, 16, 120],
          'heatmap-intensity': 0.9,
          'heatmap-opacity': 0.55,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)', 0.15, 'rgba(122,75,234,0.25)', 0.4, 'rgba(185,58,198,0.45)', 0.7, 'rgba(224,51,143,0.6)', 1, 'rgba(255,95,168,0.75)',
          ],
        },
      });
      map.addSource('accuracy', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'accuracy-fill', type: 'fill', source: 'accuracy', paint: { 'fill-color': '#F4F1F6', 'fill-opacity': 0.06 } });
      map.addLayer({ id: 'accuracy-line', type: 'line', source: 'accuracy', paint: { 'line-color': '#F4F1F6', 'line-opacity': 0.2, 'line-width': 1 } });
      ready.current = true;
      syncPins();
      syncUser();
      // o "calor da noite" respira devagar — a cidade parece viva sem distrair
      if (!reduceMotion()) {
        let last = 0;
        const tick = (t: number) => {
          if (t - last > 120) {
            last = t;
            if (map.getLayer('heat')) map.setPaintProperty('heat', 'heatmap-opacity', 0.45 + 0.15 * Math.sin(t / 1400));
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
    });
    map.on('moveend', () => cb.current.onRegionChangeComplete(regionOf(map)));
    map.on('zoomend', () => requestAnimationFrame(declutter));
    map.on('click', () => cb.current.onSelect(null));
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);
    syncPins();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.remove();
      el.remove();
      mapRef.current = null;
      ready.current = false;
      markers.current.clear();
      userMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(syncPins, [events, selectedId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(syncUser, [userLocation?.latitude, userLocation?.longitude, userAccuracyM]);

  // pin selecionado entra na área visível (acima do bottom sheet) com voo suave
  useEffect(() => {
    const map = mapRef.current;
    const e = events.find((x) => x.id === selectedId);
    if (!map || !e) return;
    const pt = map.project([e.longitude, e.latitude]);
    const { height } = map.getContainer().getBoundingClientRect();
    if (pt.y < insets.current.top + 40 || pt.y > height - insets.current.bottom - 40) {
      map.easeTo({ center: [e.longitude, e.latitude], padding: pad(), duration: reduceMotion() ? 0 : 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View ref={host as never} style={StyleSheet.absoluteFill} accessibilityLabel="Mapa dos rolês" />
      <View style={[styles.zoom, { top: topInset + spacing.md }]}>
        <Pressable onPress={() => mapRef.current?.zoomIn({ duration: reduceMotion() ? 0 : 300 })} style={styles.zoomBtn} accessibilityRole="button" accessibilityLabel="Aproximar">
          <Plus size={18} color={colors.text} />
        </Pressable>
        <View style={styles.zoomSep} />
        <Pressable onPress={() => mapRef.current?.zoomOut({ duration: reduceMotion() ? 0 : 300 })} style={styles.zoomBtn} accessibilityRole="button" accessibilityLabel="Afastar">
          <Minus size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zoom: { position: 'absolute', right: spacing.lg, zIndex: 5, borderRadius: radius.md, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  zoomBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  zoomSep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
