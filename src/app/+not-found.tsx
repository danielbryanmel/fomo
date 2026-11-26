import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Appear } from '@/components/motion';
import { Button, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

/** 404 — momento de marca: título largo em caixa alta e a lua em contorno magenta. */
export default function NotFound() {
  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.root}>
      <View style={styles.center}>
        <Appear kind="zoom">
          <Svg width={64} height={64} viewBox="-110 -110 220 220">
            <Path d="M95.1 -31.0A100.0 100.0 0 1 1 31.0 -95.1A55.0 55.0 0 1 0 95.1 -31.0Z" fill="none" stroke={colors.accent} strokeWidth={10} strokeLinejoin="round" />
          </Svg>
        </Appear>
        <Appear delay={80}><Text variant="brand" accessibilityRole="header">Esse rolê não existe.</Text></Appear>
        <Appear delay={140}><Text tone="secondary" style={{ fontSize: 17, lineHeight: 24 }}>O link pode estar quebrado ou o conteúdo foi removido.</Text></Appear>
      </View>
      <Button label="Voltar pro Explorar" fullWidth onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: 'space-between', paddingBottom: spacing.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', gap: spacing.lg },
});
