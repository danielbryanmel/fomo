type Props = { intensity?: number; variant?: 'top' | 'center' | 'split' };

/** Antes: brilhos em gradiente. O redesign proíbe gradientes — mantido como no-op para não quebrar telas. */
export function Ambient(_: Props) {
  return null;
}
