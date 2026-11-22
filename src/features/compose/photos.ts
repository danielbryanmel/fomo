import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { LocalPhoto } from '@/types/domain';

export const MAX_PHOTOS = 10;
/** Lado maior após redução — bom para tela de celular, leve para upload (~200–400 KB). */
const MAX_SIDE = 1440;
const JPEG_QUALITY = 0.8;

/** Reduz e converte para JPEG (remove EXIF/GPS embutido na foto original). */
export async function preparePhoto(asset: { uri: string; width: number; height: number }): Promise<LocalPhoto> {
  const landscape = asset.width >= asset.height;
  const needsResize = Math.max(asset.width, asset.height) > MAX_SIDE;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (needsResize) ctx.resize(landscape ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Galeria (várias fotos). Deve ser chamada a partir de um toque (exigência da Web). */
export async function pickFromLibrary(remaining: number): Promise<LocalPhoto[]> {
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
  return Promise.all(res.assets.slice(0, remaining).map(preparePhoto));
}

export type CameraResult = { photos: LocalPhoto[]; denied: boolean };

export async function takePhoto(): Promise<CameraResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { photos: [], denied: true };
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  if (res.canceled || !res.assets?.[0]) return { photos: [], denied: false };
  return { photos: [await preparePhoto(res.assets[0])], denied: false };
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
