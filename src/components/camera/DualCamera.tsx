import { useEffect } from 'react';
import { takePhoto } from '@/features/compose/photos';
import type { LocalPhoto } from '@/types/domain';

export type DualCameraProps = {
  visible: boolean;
  onClose: () => void;
  onDone: (photo: LocalPhoto, isDual: boolean) => void;
  /** 'story' = 1080×1920 (9:16); 'post' = 1080×1440 (3:4). */
  format?: 'post' | 'story';
};

/**
 * Nativo (por enquanto): abre a câmera do sistema e devolve UMA foto.
 * A versão Web (DualCamera.web.tsx) faz traseira + frontal numa imagem só.
 */
export function DualCamera({ visible, onClose, onDone, format = 'post' }: DualCameraProps) {
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void takePhoto(format).then((r) => {
      if (!alive) return;
      if (r.photos[0]) onDone(r.photos[0], false);
      else onClose();
    });
    return () => {
      alive = false;
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
