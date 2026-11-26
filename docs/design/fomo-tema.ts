// FOMO · tema do app (React Native / Expo ou web com CSS-in-JS)
// Fonte: Archivo. No Expo: npx expo install @expo-google-fonts/archivo
// Para os títulos de marca (caixa alta, largo), use Archivo Black ou a variável com wdth 112.

export const colors = {
  bg: '#0A0A0B',
  surface: '#151417',
  surface2: '#1E1D22',
  line: '#2A2930',
  lineStrong: '#3A3842',

  text: '#F4F1F6',
  text2: '#A9A3B2',
  text3: '#6E6877',

  magenta: '#E0338F', // ação principal (texto preto em cima)
  violeta: '#8A3FFC',
  lima: '#D9FF42',    // ao vivo, confirmado, credibilidade
} as const;

// Termômetro: a mesma escala em mapa, lista, feed e "Contar como tá"
export const lotacao = {
  vazio:     { bg: '#2A2930', fg: colors.text2, dot: '#4A4552', label: 'Vazio' },
  tranquilo: { bg: colors.violeta, fg: colors.text, dot: colors.violeta, label: 'Tranquilo' },
  cheio:     { bg: colors.magenta, fg: colors.bg, dot: colors.magenta, label: 'Cheio' },
  lotado:    { bg: colors.lima, fg: colors.bg, dot: colors.lima, label: 'Lotado' },
} as const;

export const font = {
  family: 'Archivo',
  size: { xs: 12, sm: 13, md: 15, lg: 16, xl: 22, xxl: 30, hero: 40 },
  weight: { regular: '400', semibold: '600', bold: '700', heavy: '800', black: '900' },
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const space = { screen: 16, gap: 10, section: 22 } as const;

export const button = {
  height: 54,
  primary:   { backgroundColor: colors.magenta, color: colors.bg },
  secondary: { backgroundColor: colors.surface2, color: colors.text },
  outline:   { backgroundColor: 'transparent', color: colors.text, borderColor: colors.lineStrong, borderWidth: 1.5 },
  safe:      { backgroundColor: colors.lima, color: colors.bg },
  disabled:  { backgroundColor: colors.surface2, color: colors.text3 },
} as const;

export const theme = { colors, lotacao, font, radius, space, button };
export default theme;
