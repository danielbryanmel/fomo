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
export const demoPhoto = (path: string): number | undefined => DEMO[path];
