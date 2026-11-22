import { Linking, Platform, Share } from 'react-native';

/** Abre rota no app de mapas do sistema (sem SDK extra). */
export async function openDirections(lat: number, lng: number, label?: string) {
  const q = encodeURIComponent(label ?? `${lat},${lng}`);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${q}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  await Linking.openURL(url);
}

export async function openExternal(url: string) {
  await Linking.openURL(url);
}

/**
 * Compartilhamento nativo. Retorna false quando não há suporte (ex.: alguns navegadores),
 * para a UI oferecer "copiar link" como fallback.
 */
export async function shareContent(title: string, url: string): Promise<boolean> {
  try {
    await Share.share(Platform.OS === 'ios' ? { title, url } : { title, message: `${title}\n${url}` });
    return true;
  } catch {
    return false;
  }
}

/**
 * URL pública para compartilhar. Web: o próprio endereço onde o app está (ex.: o *.vercel.app).
 * Nativo: EXPO_PUBLIC_SITE_URL (o mesmo link da Vercel). Nunca um domínio que não é nosso.
 */
export const publicUrl = (path: string) => {
  const origin =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  return origin ? `${origin}${path}` : path;
};
