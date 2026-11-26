import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '@/theme';
import { FomoIntro } from './FomoIntro';

/**
 * Abertura do logo a cada vez que o app é aberto do zero (app fechado → aberto de novo).
 * Fica por cima de tudo enquanto o app carrega por baixo; toque pula. Navegar dentro do app
 * não repete (o estado vive enquanto o processo/aba vive). Respeita "reduzir movimento".
 */
let playedThisLaunch = false;

export function LaunchIntro() {
  const { width } = useWindowDimensions();
  const [show, setShow] = useState(!playedThisLaunch);

  useEffect(() => {
    playedThisLaunch = true;
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!show) return null;
  return (
    <Animated.View exiting={FadeOut.duration(280)} style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Pressable style={styles.fill} onPress={() => setShow(false)} accessibilityRole="button" accessibilityLabel="Pular abertura">
        <FomoIntro width={Math.min(width, 520)} onDone={() => setTimeout(() => setShow(false), 500)} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 1000, backgroundColor: colors.background },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
