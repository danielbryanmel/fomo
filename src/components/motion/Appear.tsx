import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { motion } from '@/theme';

type Kind = 'up' | 'down' | 'fade' | 'zoom';

type Props = {
  children: ReactNode;
  /** Posição na lista: gera a cascata. Limitado para listas longas não "arrastarem". */
  index?: number;
  delay?: number;
  kind?: Kind;
  style?: StyleProp<ViewStyle>;
};

const MAX_STAGGER = 8;

function build(kind: Kind, delay: number) {
  const base =
    kind === 'up' ? FadeInDown.springify().damping(motion.spring.soft.damping).stiffness(motion.spring.soft.stiffness)
    : kind === 'down' ? FadeInUp.springify().damping(motion.spring.soft.damping).stiffness(motion.spring.soft.stiffness)
    : kind === 'zoom' ? ZoomIn.springify().damping(motion.spring.bouncy.damping + 4).stiffness(motion.spring.bouncy.stiffness)
    : FadeIn.duration(motion.slow);
  // ReduceMotion.System: some quando o sistema pede menos movimento.
  return base.delay(delay).reduceMotion(ReduceMotion.System);
}

/**
 * Entrada suave de um bloco (sobe 12–20 px e aparece). `kind="up"` é o padrão
 * para conteúdo; `zoom` só para recompensas (+XP, confirmação).
 */
export function Appear({ children, index = 0, delay = 0, kind = 'up', style }: Props) {
  const d = delay + Math.min(index, MAX_STAGGER) * motion.stagger;
  return (
    <Animated.View entering={build(kind, d)} style={style}>
      {children}
    </Animated.View>
  );
}
