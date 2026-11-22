import { Platform } from 'react-native';

/**
 * Design tokens do FOMO — fonte única de cor, espaço, raio, tipografia e movimento.
 * Nenhum componente deve usar hex/números mágicos fora deste arquivo.
 *
 * Linguagem visual v2 ("termômetro da noite"):
 *  - fundo quase preto com brilhos difusos (Ambient) só em telas-chave;
 *  - títulos grandes e compactos + micro-rótulos mono em caixa alta para metadados;
 *  - escala de calor DENTRO da marca (roxo → magenta → rosa → rosa incandescente);
 *  - verde-limão reservado para "AO VIVO" e "+XP" (raro de propósito).
 */

/** Cores da marca (símbolo) — amostradas da prancha "FOMO / Identidade V4". */
export const brand = {
  black: '#0A0A0C',
  white: '#F4F3F6',
  pink: '#C938AE',
  pinkVivid: '#E8368C',
  magenta: '#B93AC6',
  purple: '#8A36E8',
  highlight: '#FBE6F5',
} as const;

const palette = {
  black: brand.black,
  ink950: '#0F0E12',
  ink900: '#141216',
  ink800: '#1C1A20',
  ink700: '#2C2A31',
  ink500: '#7E7C86', // ≈ 4.7:1 sobre o fundo (AA)
  ink300: '#B8B6C0',
  white: '#FFFFFF',

  pink: brand.pinkVivid,
  magenta: brand.magenta,
  purple: brand.purple,

  live: '#D4FF3F',
  success: '#34C77B',
  warning: '#F5B93D',
  danger: '#FF5A5F',
} as const;

export const colors = {
  background: palette.black,
  surface: palette.ink950,
  surfaceRaised: palette.ink800,
  border: 'rgba(255,255,255,0.08)',
  borderStrong: palette.ink700,

  text: palette.white,
  textSecondary: palette.ink300,
  textMuted: palette.ink500,
  textOnAccent: palette.white,
  textOnLive: '#101208',

  accent: palette.magenta,
  accentPink: palette.pink,
  accentPurple: palette.purple,
  /** Gradiente da marca: símbolo, CTA primário, progresso de nível. */
  brandGradient: [palette.pink, palette.magenta, palette.purple] as const,

  /** Sinal "ao vivo"/"+XP". Nunca como cor de fundo grande. */
  live: palette.live,

  /** Escala de lotação (1–4). Sempre acompanhada de texto e segmentos — nunca só cor. */
  heat: {
    none: '#3A3840',
    1: '#7A4BEA', // tranquilo
    2: '#B93AC6', // animado
    3: '#E8368C', // cheio
    4: '#FF5FA8', // lotado
  },

  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,

  /** Indicadores sociais — visualmente distintos (decisão V2). */
  signal: {
    popularity: palette.ink300,
    experience: palette.purple,
    credibility: palette.success,
  },

  overlay: 'rgba(10,10,12,0.78)',
  glass: 'rgba(20,18,24,0.72)',
  pressed: 'rgba(255,255,255,0.06)',
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
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, Menlo, monospace' });

/** Tipografia nativa (SF/Roboto/system-ui) + mono do sistema para micro-rótulos. */
export const typography = {
  hero: { fontSize: 44, lineHeight: 46, fontWeight: '800', letterSpacing: -1.4 },
  display: { fontSize: 32, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 },
  title: { fontSize: 24, lineHeight: 28, fontWeight: '700', letterSpacing: -0.5 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2 },
  /** Metadados: "FESTA · TECHNO · 350 M". Mínimo 11 pt por legibilidade. */
  mono: { fontSize: 11, lineHeight: 15, fontWeight: '500', letterSpacing: 1.2, fontFamily: mono, textTransform: 'uppercase' },
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

/** Altura reservada para a tab bar flutuante (conteúdo rolável precisa de paddingBottom). */
export const TAB_BAR_SPACE = 96;

export const tokens = { colors, spacing, radius, typography, motion, hitTarget } as const;
export type Tokens = typeof tokens;
