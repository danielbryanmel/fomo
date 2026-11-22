import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Activity, LocateFixed, MapPinned, UserRound } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FomoLockup } from '@/components/brand/FomoLockup';
import { FomoMark } from '@/components/brand/FomoMark';
import { Ambient, Button, Screen, Text } from '@/components/ui';
import { completeOnboarding } from '@/features/onboarding/onboardingStore';
import { colors, radius, spacing } from '@/theme';

type Step = { icon: ReactNode; title: string; body: string };

const STEPS: Step[] = [
  {
    icon: <Activity size={28} color={colors.accentPink} />,
    title: 'De olho no rolê',
    body: 'Abra e veja onde tá bom agora: lotação, vibe e fila contadas por quem está lá. Relato velho não vale.',
  },
  {
    icon: <MapPinned size={28} color={colors.accentPink} />,
    title: 'Tá no rolê? Conta',
    body: 'Três toques e pronto. Confirmamos uma vez que você está no local — sem rastrear depois.',
  },
  {
    icon: <UserRound size={28} color={colors.accentPink} />,
    title: 'Construa sua reputação',
    body: 'Popularidade, experiência e credibilidade são medidas separadas. Credibilidade vem da qualidade do que você compartilha, não de curtidas.',
  },
  {
    icon: <LocateFixed size={28} color={colors.accentPink} />,
    title: 'Localização só quando você quiser',
    body: 'Pedimos só quando você toca em "perto de mim" ou envia um relato. Sem permitir, dá para escolher o bairro.',
  },
];

export default function Onboarding() {
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  async function finish() {
    await completeOnboarding();
    router.replace('/');
  }

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.root}>
      <Ambient variant="center" intensity={0.9} />
      <View style={styles.top}>
        <FomoLockup size={24} />
        {!last ? <Button label="Pular" variant="ghost" onPress={finish} /> : <View />}
      </View>

      <View style={styles.center} accessibilityLiveRegion="polite">
        <View style={styles.hero}>
          <FomoMark size={120} variant="glass" />
          <View style={styles.iconBadge}>{step.icon}</View>
        </View>
        <Text variant="hero" align="center">{step.title}</Text>
        <Text tone="secondary" align="center" style={styles.body}>{step.body}</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots} accessibilityLabel={`Passo ${i + 1} de ${STEPS.length}`}>
          {STEPS.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === i && styles.dotActive]} />
          ))}
        </View>
        <Button label={last ? 'Começar' : 'Continuar'} fullWidth onPress={() => (last ? finish() : setI(i + 1))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: 'space-between', paddingBottom: spacing.lg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm },
  center: { alignItems: 'center', gap: spacing.lg, maxWidth: 420, alignSelf: 'center' },
  hero: { marginBottom: spacing.xl },
  iconBadge: {
    position: 'absolute',
    right: -12,
    bottom: -12,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { maxWidth: 360 },
  bottom: { gap: spacing.xl, maxWidth: 420, width: '100%', alignSelf: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.accentPink },
});
