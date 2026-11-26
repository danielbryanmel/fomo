import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type { LocalPhoto } from '@/types/domain';

export const MAX_PHOTOS = 10;
/** Lado maior após redução — bom para tela de celular, leve para upload (~200–400 KB). */
const MAX_SIDE = 1440;
const JPEG_QUALITY = 0.8;

/** Story: tela cheia 9:16. */
export const STORY_W = 1080;
export const STORY_H = 1920;

type Target = { maxSide?: number; cover?: { width: number; height: number } };

/**
 * Web: desenha a foto direto num canvas JÁ no tamanho final.
 * O manipulador do Expo cria antes um canvas do tamanho ORIGINAL — fotos da galeria do iPhone
 * (24/48 MP) passam do limite de canvas do Safari e a foto "não sobe". A câmera do app gera
 * imagens pequenas, por isso só a galeria falhava. Reencodar em JPEG também remove EXIF/GPS.
 */
async function webPrepare(uri: string, t: Target): Promise<LocalPhoto> {
  const img = new Image();
  img.decoding = 'async';
  img.src = uri;
  try {
    await img.decode();
  } catch {
    await new Promise<void>((res, rej) => {
      if (img.complete && img.naturalWidth) return res();
      img.onload = () => res();
      img.onerror = () => rej(new Error('Formato de foto não suportado. Tente outra foto.'));
    });
  }
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) throw new Error('Não foi possível ler essa foto.');
  let w: number, h: number, sx = 0, sy = 0, sw = iw, sh = ih;
  if (t.cover) {
    ({ width: w, height: h } = t.cover);
    const r = Math.max(w / iw, h / ih);
    sw = w / r;
    sh = h / r;
    sx = (iw - sw) / 2;
    sy = (ih - sh) / 2;
  } else {
    const k = Math.min(1, (t.maxSide ?? MAX_SIDE) / Math.max(iw, ih));
    w = Math.round(iw * k);
    h = Math.round(ih * k);
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a foto.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Não foi possível preparar a foto.'))), 'image/jpeg', JPEG_QUALITY));
  c.width = c.height = 0; // libera memória no Safari
  return { uri: URL.createObjectURL(blob), width: w, height: h };
}

/** Recorta (como object-fit: cover) para o tamanho exato. Usado nos stories (1080×1920). */
export async function prepareCover(asset: { uri: string; width: number; height: number }, width = STORY_W, height = STORY_H): Promise<LocalPhoto> {
  if (Platform.OS === 'web') return webPrepare(asset.uri, { cover: { width, height } });
  const r = Math.max(width / asset.width, height / asset.height);
  const cw = Math.round(width / r);
  const ch = Math.round(height / r);
  const ctx = ImageManipulator.manipulate(asset.uri);
  ctx.crop({ originX: Math.round((asset.width - cw) / 2), originY: Math.round((asset.height - ch) / 2), width: cw, height: ch });
  ctx.resize({ width, height });
  const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Reduz e converte para JPEG (remove EXIF/GPS embutido na foto original). */
export async function preparePhoto(asset: { uri: string; width: number; height: number }): Promise<LocalPhoto> {
  if (Platform.OS === 'web') return webPrepare(asset.uri, { maxSide: MAX_SIDE });
  const landscape = asset.width >= asset.height;
  const needsResize = Math.max(asset.width, asset.height) > MAX_SIDE;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (needsResize) ctx.resize(landscape ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Galeria (várias fotos). Deve ser chamada a partir de um toque (exigência da Web). */
export async function pickFromLibrary(remaining: number, format: 'post' | 'story' = 'post'): Promise<LocalPhoto[]> {
  if (remaining <= 0) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    orderedSelection: true,
    quality: 1,
    exif: false,
  });
  if (res.canceled || !res.assets) return [];
  const prep = format === 'story' ? (a: (typeof res.assets)[number]) => prepareCover(a) : preparePhoto;
  // uma de cada vez: várias fotos grandes ao mesmo tempo estouram a memória do Safari
  const out: LocalPhoto[] = [];
  for (const a of res.assets.slice(0, remaining)) out.push(await prep(a));
  return out;
}

export type CameraResult = { photos: LocalPhoto[]; denied: boolean };

export async function takePhoto(format: 'post' | 'story' = 'post'): Promise<CameraResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { photos: [], denied: true };
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  if (res.canceled || !res.assets?.[0]) return { photos: [], denied: false };
  return { photos: [format === 'story' ? await prepareCover(res.assets[0]) : await preparePhoto(res.assets[0])], denied: false };
}

/** Proporção exibida no feed: entre 4:5 (retrato) e 1.91:1 (paisagem), como no Instagram. */
export function displayRatio(width: number, height: number) {
  const r = width / height;
  return Math.min(1.91, Math.max(0.8, r));
}

/** Avatar: 1 foto, recorte quadrado, 512 px, JPEG sem EXIF. */
export async function pickAvatar(): Promise<LocalPhoto | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1, exif: false });
  const a = res.canceled ? null : res.assets?.[0];
  if (!a) return null;
  const side = Math.min(a.width, a.height);
  const ctx = ImageManipulator.manipulate(a.uri);
  if (a.width !== a.height) ctx.crop({ originX: (a.width - side) / 2, originY: (a.height - side) / 2, width: side, height: side });
  if (side > 512) ctx.resize({ width: 512, height: 512 });
  const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
