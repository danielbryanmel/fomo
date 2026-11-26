/**
 * Fotos do conteúdo de demonstração (supabase/demo.sql): ficam EMPACOTADAS no app,
 * não no Storage — custo zero de banda/armazenamento no plano gratuito.
 * São imagens abstratas geradas (luzes desfocadas), não fotos reais de lugares.
 */
const DEMO: Record<string, number> = {
  'demo/night-1.jpg': require('../../assets/mock/night-1.jpg'),
  'demo/night-2.jpg': require('../../assets/mock/night-2.jpg'),
  'demo/night-3.jpg': require('../../assets/mock/night-3.jpg'),
  'demo/night-4.jpg': require('../../assets/mock/night-4.jpg'),
  'demo/night-5.jpg': require('../../assets/mock/night-5.jpg'),
  'demo/night-6.jpg': require('../../assets/mock/night-6.jpg'),
};

export const isDemoPath = (path: string) => path.startsWith('demo/');
/** Aceita sufixo "#…" (stories demo reaproveitam a mesma foto com caminhos únicos). */
export const demoPhoto = (path: string): number | undefined => DEMO[path.split('#')[0]!];

/** Capa para rolê de demonstração sem foto: uma das fotos empacotadas, sempre a mesma por rolê. */
export const demoCover = (id: string) => {
  const h = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  return `demo/night-${(h % 6) + 1}.jpg`;
};

/** Converte uma URL de capa (remota ou "demo/…") em fonte de imagem. */
export const coverSource = (uri: string): { uri: string } | number => (isDemoPath(uri) ? (demoPhoto(uri) ?? { uri }) : { uri });
