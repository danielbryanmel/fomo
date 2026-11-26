import { Platform } from 'react-native';

/**
 * Design tokens do FOMO — fonte única de cor, espaço, raio, tipografia e movimento.
 * Nenhum componente deve usar hex/números mágicos fora deste arquivo.
 *
 * Linguagem visual v3 (redesign "letreiro", nov/2026 — ver docs/design/GUIA.md):
 *  - uma fonte só (Archivo); sem mono, sem rótulos em CAIXA ALTA ESPAÇADA;
 *  - cor chapada, sem degradê; botão principal magenta com texto preto;
 *  - título de marca (caixa alta, largo) só em onboarding, login, 404 e Minha noite;
 *  - termômetro com cor fixa: Vazio · Tranquilo · Cheio · Lotado;
 *  - verde-limão = "verdadeiro agora" (ao vivo, confirmado, credibilidade, cheguei bem);
 *  - selecionado = branco com texto preto.
 */

/** Cores da marca. */
export const brand = {
  black: '#0A0A0B',
  white: '#F4F1F6',
  magenta: '#E0338F',
  violeta: '#8A3FFC',
  lima: '#D9FF42',
  // compat (nomes antigos)
  pink: '#E0338F',
  pinkVivid: '#E0338F',
  purple: '#8A3FFC',
  highlight: '#F4F1F6',
} as const;

export const colors = {
  background: brand.black,
  surface: '#151417',
  surfaceRaised: '#1E1D22',
  border: '#2A2930',
  borderStrong: '#3A3842',

  text: brand.white,
  textSecondary: '#A9A3B2',
  textMuted: '#6E6877',
  /** Texto sobre magenta/lima/branco: preto. */
  textOnAccent: brand.black,
  textOnLive: brand.black,

  accent: brand.magenta,
  accentPink: brand.magenta,
  accentPurple: brand.violeta,
  /** Sem degradê no redesign: mantido só por compatibilidade (todas as cores iguais = chapado). */
  brandGradient: [brand.magenta, brand.magenta, brand.magenta] as const,

  /** "Verdadeiro agora": ao vivo, presença confirmada, credibilidade, cheguei bem. */
  live: brand.lima,

  /** Termômetro (lotação 1–4) — mesma cor no mapa, lista, feed, story e grupos. */
  heat: {
    none: '#4A4552',
    1: '#4A4552', // vazio
    2: brand.violeta, // tranquilo
    3: brand.magenta, // cheio
    4: brand.lima, // lotado
  },

  /** Selecionado: fundo branco, texto preto. */
  selected: brand.white,
  onSelected: brand.black,

  success: brand.lima,
  warning: '#F5B93D',
  danger: '#FF5A5F',

  signal: {
    popularity: '#A9A3B2',
    experience: brand.violeta,
    credibility: brand.lima,
  },

  overlay: 'rgba(10,10,11,0.82)',
  glass: 'rgba(21,20,23,0.92)',
  pressed: 'rgba(255,255,255,0.06)',
} as const;

/** Escala de lotação (rótulo + cores da etiqueta). */
export const heatScale = {
  1: { label: 'Vazio', bg: '#2A2930', fg: '#A9A3B2', dot: '#4A4552' },
  2: { label: 'Tranquilo', bg: brand.violeta, fg: brand.white, dot: brand.violeta },
  3: { label: 'Cheio', bg: brand.magenta, fg: brand.black, dot: brand.magenta },
  4: { label: 'Lotado', bg: brand.lima, fg: brand.black, dot: brand.lima },
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Archivo (estática, gerada da variável). Cada peso é uma família — funciona igual no iOS, Android e web. */
export const fonts = {
  regular: 'Archivo-Regular',
  semibold: 'Archivo-SemiBold',
  bold: 'Archivo-Bold',
  extrabold: 'Archivo-ExtraBold',
  black: 'Archivo-Black',
  /** Título de marca: largura 112%, peso 900. */
  brand: 'ArchivoExpanded-Black',
} as const;

const f = (family: string) => ({ fontFamily: `${family}, Archivo, system-ui, sans-serif` }) as const;
const fam = Platform.OS === 'web' ? f : (family: string) => ({ fontFamily: family });

/** Tipografia: uma fonte só, frases normais (sem caixa alta espaçada). */
export const typography = {
  /** Título de marca (onboarding, login, 404, Minha noite): caixa alta, larga, 900. Demais títulos: largos em frase normal. */
  brand: { fontSize: 42, lineHeight: 43, letterSpacing: -0.6, textTransform: 'uppercase', ...fam(fonts.brand) },
  hero: { fontSize: 36, lineHeight: 40, letterSpacing: -0.6, ...fam(fonts.brand) },
  /** Título de aba (Feed, Quero ir). */
  display: { fontSize: 28, lineHeight: 33, letterSpacing: -0.5, ...fam(fonts.brand) },
  /** Título de tela interna. */
  title: { fontSize: 21, lineHeight: 26, letterSpacing: -0.3, ...fam(fonts.brand) },
  headline: { fontSize: 17, lineHeight: 22, letterSpacing: -0.2, ...fam(fonts.brand) },
  body: { fontSize: 15, lineHeight: 21, ...fam(fonts.regular) },
  bodyStrong: { fontSize: 15, lineHeight: 21, ...fam(fonts.bold) },
  caption: { fontSize: 13, lineHeight: 18, ...fam(fonts.regular) },
  label: { fontSize: 13, lineHeight: 17, ...fam(fonts.semibold) },
  /** Antigo "mono": agora rótulo de seção em frase normal (15/800). */
  mono: { fontSize: 13, lineHeight: 18, ...fam(fonts.semibold) },
  /** Título de seção. */
  section: { fontSize: 15, lineHeight: 20, ...fam(fonts.extrabold) },
} as const;

export type TypographyVariant = keyof typeof typography;

export const motion = {
  fast: 150,
  base: 220,
  slow: 320,
  /** Atraso entre itens de lista que entram em cascata (máx. ~8 itens). */
  stagger: 45,
  /** Molas: `snappy` para toques, `soft` para entradas/indicadores, `bouncy` para recompensas (+XP, curtida). */
  spring: {
    snappy: { damping: 20, stiffness: 420, mass: 0.6 },
    soft: { damping: 22, stiffness: 220, mass: 0.9 },
    bouncy: { damping: 9, stiffness: 260, mass: 0.7 },
  },
} as const;

/** Alvo mínimo de toque (Apple HIG 44pt / Material 48dp). */
export const hitTarget = 48;

/** Altura reservada para a barra inferior fixa (conteúdo rolável precisa de paddingBottom). */
export const TAB_BAR_SPACE = 96;

export const tokens = { colors, spacing, radius, typography, motion, hitTarget } as const;
export type Tokens = typeof tokens;
