/**
 * Ícones de interação PRÓPRIOS do FOMO (não são os do Instagram):
 *  - Curtir  → "Fomo": o próprio símbolo da marca (o olhar que escapa). Ativo = magenta chapado (meia-lua cheia).
 *  - Comentar → "Papo": balão quadrado-arredondado com a cauda saindo pela esquerda.
 *  - Chamar  → "Chama a galera": seta saindo de uma órbita (convite, não "enviar DM").
 *  - Salvar  → "Quero ir": ingresso com picote — salvar um rolê é guardar o ingresso.
 * Todos em grade 24×24, traço 1.9, cantos arredondados — mesma família do lucide usado no resto do app.
 */
import { useId } from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { FOMO_MARK_PATH } from '@/components/brand/FomoMark';
import { colors } from '@/theme';

type IconProps = { size?: number; color?: string; active?: boolean; strokeWidth?: number };

function BrandGradient(_: { id: string }) {
  return null; // redesign: sem degradê, curtido = magenta chapado
}

const useGid = (p: string) => `${p}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

/** Curtir = o símbolo da marca. */
export function FomoLikeIcon({ size = 24, color = colors.text, active, strokeWidth = 1.9 }: IconProps) {
  const gid = useGid('lk');
  // o símbolo vive numa grade 100×100; escalamos para caber em 24 com respiro
  const sw = (strokeWidth * 200) / 20;
  return (
    <Svg width={size} height={size} viewBox="-116 -116 232 232">
      {active ? <BrandGradient id={gid} /> : null}
      <Path
        d={FOMO_MARK_PATH}
        fill={active ? colors.accent : 'none'}
        stroke={active ? 'none' : color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Comentar = "papo". */
export function FomoCommentIcon({ size = 24, color = colors.text, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4.5h10a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1-3.5 3.5h-6.2L6 21v-3.6A3.5 3.5 0 0 1 3.5 14V8A3.5 3.5 0 0 1 7 4.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M8.5 11h7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Compartilhar = "chama a galera". */
export function FomoShareIcon({ size = 24, color = colors.text, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19.5 12.5A7.5 7.5 0 1 1 11.5 4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M13 11l7-7M15 4h5v5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Salvar = "quero ir" (ingresso). */
export function FomoSaveIcon({ size = 24, color = colors.text, active, strokeWidth = 1.9 }: IconProps) {
  const gid = useGid('sv');
  // ingresso deitado, picote pequeno nas laterais (legível mesmo em 18 px)
  const d =
    'M3.5 7.5A2 2 0 0 1 5.5 5.5h13a2 2 0 0 1 2 2v2.6a1.9 1.9 0 0 0 0 3.8v2.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-2.6a1.9 1.9 0 0 0 0-3.8V7.5Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {active ? <BrandGradient id={gid} /> : null}
      <Path d={d} fill={active ? colors.accent : 'none'} stroke={active ? 'none' : color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <G opacity={active ? 0.9 : 1}>
        <Path d="M15 8.25v1M15 11.5v1M15 14.75v1" stroke={active ? colors.background : color} strokeWidth={strokeWidth * 0.9} strokeLinecap="round" />
      </G>
    </Svg>
  );
}

/** Símbolo grande para o toque duplo (substitui o coração). */
export function FomoBurst({ size = 96 }: { size?: number }) {
  const gid = useGid('bu');
  return (
    <Svg width={size} height={size} viewBox="-112 -112 224 224">
      <BrandGradient id={gid} />
      <Path d={FOMO_MARK_PATH} fill={colors.accent} />
      <Circle cx="84" cy="14" r="4" fill={colors.text} opacity={0.9} />
      <Circle cx="96" cy="30" r="2.5" fill={colors.text} opacity={0.7} />
    </Svg>
  );
}
