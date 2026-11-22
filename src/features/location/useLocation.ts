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
          void readOnce().then((p) => alive && p && setPosition(p));
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
      const p = await readOnce();
      setPosition(p);
      return p;
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

  return { status, position, neighborhood, origin, request, setNeighborhood, refresh: readOnce };
}

/** Leitura única com precisão equilibrada (economiza bateria). */
export async function readOnce(): Promise<GeoPoint | null> {
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
    const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: cur.coords.latitude, longitude: cur.coords.longitude };
  } catch {
    return null;
  }
}

/** Endereço → coordenada pelo geocodificador do sistema (iOS/Android). Na Web devolve null. */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  if (Platform.OS === 'web' || !address.trim()) return null;
  try {
    const [hit] = await Location.geocodeAsync(address);
    return hit ? { latitude: hit.latitude, longitude: hit.longitude } : null;
  } catch {
    return null;
  }
}
