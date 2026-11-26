import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';
import { FOMO_LETTERS } from './paths';

/**
 * Abertura do logo (manual de marca, "pop → cut → slide → rise"):
 * o círculo aparece, ganha o corte e vira o símbolo; o símbolo desliza e o nome sobe ao lado.
 * Geometria do manual num quadro 1600×900 (centro 800,450), escalado por `width`.
 */
const OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
const INOUT = Easing.bezier(0.75, 0, 0.2, 1);

export function FomoIntro({ width, onDone }: { width: number; onDone?: () => void }) {
  const u = width / 1600;
  const H = 520 * u; // recorte vertical do quadro (círculo r=230 cabe)
  const cy = H / 2;
  const R = 230 * u;
  const reduce = useReducedMotion();

  const pop = useSharedValue(reduce ? 1 : 0);
  const cut = useSharedValue(reduce ? 1 : 0);
  const slide = useSharedValue(reduce ? 1 : 0);
  const letters = FOMO_LETTERS.map(() => useSharedValue(reduce ? 1 : 0)); // eslint-disable-line react-hooks/rules-of-hooks

  useEffect(() => {
    if (reduce) { onDone?.(); return; }
    pop.value = withDelay(200, withSequence(withTiming(1.05, { duration: 700, easing: OUT }), withTiming(1, { duration: 300, easing: OUT })));
    cut.value = withDelay(1300, withTiming(1, { duration: 900, easing: INOUT }));
    slide.value = withDelay(2400, withTiming(1, { duration: 1000, easing: INOUT }));
    letters.forEach((l, i) => {
      l.value = withDelay(2700 + i * 100, withTiming(1, { duration: 900, easing: OUT }, (fin) => {
        if (fin && i === letters.length - 1 && onDone) runOnJS(onDone)();
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const symSt = useAnimatedStyle(() => ({
    transform: [{ translateX: -555 * u * slide.value }, { scale: (1 - 0.587 * slide.value) * pop.value }],
  }));
  const cutSt = useAnimatedStyle(() => ({ transform: [{ translateX: 360 * u * (1 - cut.value) }, { translateY: -360 * u * (1 - cut.value) }] }));

  // letras: translate(395,355) scale(.276) translate(-74,0) no quadro 1600×900 → topo em y=355 (centro 450 ⇒ -95)
  const k = 0.276 * u;
  const lw = (3896 - 74) * k;
  const lh = 726 * k;
  const lx = 395 * u;
  const ly = cy - 95 * u - 14 * k;

  return (
    <View style={{ width, height: H }} accessibilityRole="image" accessibilityLabel="FOMO">
      <Animated.View style={[styles.disc, { width: 2 * R, height: 2 * R, borderRadius: R, left: width / 2 - R, top: cy - R }, symSt]}>
        <Animated.View
          style={[styles.cut, { width: 2 * 126.5 * u, height: 2 * 126.5 * u, borderRadius: 126.5 * u, left: R + 94.3 * u - 126.5 * u, top: R - 94.3 * u - 126.5 * u }, cutSt]}
        />
      </Animated.View>
      <View style={{ position: 'absolute', left: lx, top: ly, width: lw, height: lh, overflow: 'hidden' }}>
        {FOMO_LETTERS.map((d, i) => (
          <Letter key={i} d={d} v={letters[i]!} w={lw} h={lh} rise={820 * k} />
        ))}
      </View>
    </View>
  );
}

function Letter({ d, v, w, h, rise }: { d: string; v: { value: number }; w: number; h: number; rise: number }) {
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: rise * (1 - v.value) }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st]}>
      <Svg width={w} height={h} viewBox="74 -20 3822 726"><Path d={d} fill={colors.text} /></Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // sem overflow: o corte tem a cor do fundo, então a parte fora do círculo some sozinha (clip+transform falha no web)
  disc: { position: 'absolute', backgroundColor: colors.text },
  cut: { position: 'absolute', backgroundColor: colors.background },
});
