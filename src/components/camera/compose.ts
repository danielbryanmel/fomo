import type { LocalPhoto } from '@/types/domain';

/** Saída da câmera dupla: 3:4, leve para upload. */
export const DEFAULT_W = 1080;
export const DEFAULT_H = 1440;

/** Desenha `src` cobrindo o retângulo (como object-fit: cover), opcionalmente espelhado. */
function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, mirror = false) {
  const r = Math.max(w / src.width, h / src.height);
  const sw = w / r;
  const sh = h / r;
  const sx = (src.width - sw) / 2;
  const sy = (src.height - sh) / 2;
  ctx.save();
  if (mirror) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    ctx.drawImage(src, sx, sy, sw, sh, x, y, w, h);
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Congela o quadro atual do vídeo num canvas do tamanho real da câmera. */
export function grabFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = video.videoWidth || 1280;
  c.height = video.videoHeight || 720;
  c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height);
  return c;
}

/** Foto principal (traseira) + selfie no canto, com borda — no estilo "câmera dupla". */
export async function composeDual(back: HTMLCanvasElement, front: HTMLCanvasElement | null, size?: { w: number; h: number }): Promise<LocalPhoto> {
  const DUAL_W = size?.w ?? DEFAULT_W;
  const DUAL_H = size?.h ?? DEFAULT_H;
  const c = document.createElement('canvas');
  c.width = DUAL_W;
  c.height = DUAL_H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0A0A0C';
  ctx.fillRect(0, 0, DUAL_W, DUAL_H);
  drawCover(ctx, back, 0, 0, DUAL_W, DUAL_H);
  if (front) {
    const w = Math.round(DUAL_W * 0.32);
    const h = Math.round(w * (DUAL_H / DUAL_W > 1.5 ? 16 / 9 : 4 / 3));
    const m = 36;
    ctx.save();
    roundRect(ctx, m - 6, m - 6, w + 12, h + 12, 34);
    ctx.fillStyle = '#0A0A0C';
    ctx.fill();
    roundRect(ctx, m, m, w, h, 28);
    ctx.clip();
    drawCover(ctx, front, m, m, w, h, true);
    ctx.restore();
  }
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Não foi possível gerar a foto.'))), 'image/jpeg', 0.85));
  return { uri: URL.createObjectURL(blob), width: DUAL_W, height: DUAL_H };
}
