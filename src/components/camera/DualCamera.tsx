import { useEffect } from 'react';
import { takePhoto } from '@/features/compose/photos';
import type { LocalPhoto } from '@/types/domain';

export type DualCameraProps = {
  visible: boolean;
  onClose: () => void;
  onDone: (photo: LocalPhoto, isDual: boolean) => void;
};

/**
 * Nativo (por enquanto): abre a câmera do sistema e devolve UMA foto.
 * A versão Web (DualCamera.web.tsx) faz traseira + frontal numa imagem só.
 */
export function DualCamera({ visible, onClose, onDone }: DualCameraProps) {
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void takePhoto().then((r) => {
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
