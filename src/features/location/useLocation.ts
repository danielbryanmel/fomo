import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { GeoPoint, Neighborhood } from '@/types/domain';

export type LocationStatus = 'checking' | 'prompt' | 'granted' | 'denied' | 'unavailable';

const HOOD_KEY = 'fomo.neighborhood.v1';

/**
 * Localização sob demanda (decisão V2):
 *  - NÃO pede permissão ao abrir o app; só quando a pessoa toca em "Usar minha localização";
 *  - só "enquanto o app está em uso" (foreground), leitura pontual — sem watchPosition/background;
 *  - se negada ou indisponível, o app funciona por bairro escolhido manualmente.
 */
export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>('checking');
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [neighborhood, setNeighborhoodState] = useState<Neighborhood | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(HOOD_KEY);
        if (saved && alive) setNeighborhoodState(JSON.parse(saved) as Neighborhood);
      } catch {
        /* storage indisponível */
      }
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!alive) return;
        if (perm.granted) {
          setStatus('granted');
          void readFix().then((f) => {
            if (alive && f) {
              setPosition(f.point);
              setAccuracyM(f.accuracyM);
            }
          });
        } else {
          setStatus(perm.canAskAgain === false ? 'denied' : 'prompt');
        }
      } catch {
        if (alive) setStatus('unavailable');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Pede permissão (contextual) e faz UMA leitura. */
  const request = useCallback(async (): Promise<GeoPoint | null> => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setStatus(perm.canAskAgain === false ? 'denied' : 'prompt');
        return null;
      }
      setStatus('granted');
      const f = await readFix();
      setPosition(f?.point ?? null);
      setAccuracyM(f?.accuracyM ?? null);
      return f?.point ?? null;
    } catch {
      setStatus('unavailable');
      return null;
    }
  }, []);

  const setNeighborhood = useCallback(async (n: Neighborhood | null) => {
    setNeighborhoodState(n);
    try {
      if (n) await AsyncStorage.setItem(HOOD_KEY, JSON.stringify(n));
      else await AsyncStorage.removeItem(HOOD_KEY);
    } catch {
      /* ignora */
    }
  }, []);

  /** Origem para distâncias: bairro escolhido tem prioridade explícita; senão, posição. */
  const origin: GeoPoint | null = neighborhood?.center ?? position;

  return { status, position, accuracyM, neighborhood, origin, request, setNeighborhood, refresh: readOnce };
}

export type Fix = { point: GeoPoint; accuracyM: number | null };

/**
 * Web: o navegador entrega primeiro uma posição grosseira (Wi-Fi/IP) e vai refinando.
 * Ouvimos por no máximo ~8 s e ficamos com a MELHOR leitura (para cedo se chegar a ≤30 m).
 * Continua sendo leitura pontual: nada fica rodando depois (decisão V2: sem rastreamento).
 */
function webBestFix(timeoutMs = 8000): Promise<Fix | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    let best: GeolocationPosition | null = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(id);
      clearTimeout(timer);
      resolve(best ? { point: { latitude: best.coords.latitude, longitude: best.coords.longitude }, accuracyM: Math.round(best.coords.accuracy) } : null);
    };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
        if (p.coords.accuracy <= 30) finish();
      },
      () => finish(),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
    const timer = setTimeout(finish, timeoutMs);
  });
}

/** Leitura pontual com precisão alta + raio de incerteza. */
export async function readFix(): Promise<Fix | null> {
  if (Platform.OS === 'web') return webBestFix();
  try {
    const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { point: { latitude: cur.coords.latitude, longitude: cur.coords.longitude }, accuracyM: cur.coords.accuracy ?? null };
  } catch {
    return null;
  }
}

/** Leitura única com precisão equilibrada (economiza bateria). */
export async function readOnce(): Promise<GeoPoint | null> {
  if (Platform.OS === 'web') return (await webBestFix())?.point ?? null;
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 300 });
    if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: cur.coords.latitude, longitude: cur.coords.longitude };
  } catch {
    return null;
  }
}

/** Leitura precisa e fresca para validar relato no local (não usa cache). */
export async function readPreciseOnce(): Promise<GeoPoint | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    if (Platform.OS === 'web') return (await webBestFix(10000))?.point ?? null;
    const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: cur.coords.latitude, longitude: cur.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Endereço → coordenada. Nativo: geocodificador do sistema. Web: OpenStreetMap (Nominatim),
 * gratuito — uma consulta por toque (respeita a política de uso), com preferência por São Paulo.
 */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  if (!address.trim()) return null;
  if (Platform.OS === 'web') {
    try {
      const q = encodeURIComponent(address.trim());
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&viewbox=-47.2,-23.2,-46.2,-24.0&q=${q}`, {
        headers: { 'Accept-Language': 'pt-BR' },
      });
      const [hit] = (await r.json()) as { lat: string; lon: string }[];
      return hit ? { latitude: Number(hit.lat), longitude: Number(hit.lon) } : null;
    } catch {
      return null;
    }
  }
  try {
    const [hit] = await Location.geocodeAsync(address);
    return hit ? { latitude: hit.latitude, longitude: hit.longitude } : null;
  } catch {
    return null;
  }
}
