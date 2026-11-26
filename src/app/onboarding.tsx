import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Check, LocateFixed } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { FomoIntro } from '@/components/brand/FomoIntro';
import { FomoLockup } from '@/components/brand/FomoLockup';
import { ThermoBars } from '@/components/live/ThermoBars';
import { Appear } from '@/components/motion/Appear';
import { Avatar, Button, ProgressBar, Screen, Text } from '@/components/ui';
import { completeOnboarding } from '@/features/onboarding/onboardingStore';
import { colors, heatScale, radius, spacing } from '@/theme';

/* Ilustrações dos passos — exemplos visuais, não dados reais (escondidas do leitor de tela). */

function ThermoDemo() {
  const rows: { lvl: 1 | 2 | 3 | 4; place: string }[] = [
    { lvl: 1, place: 'Theatro Municipal' },
    { lvl: 2, place: 'Crema Club' },
    { lvl: 3, place: 'Central 1926' },
    { lvl: 4, place: 'Baile da Lua' },
  ];
  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((r, i) => {
        const hot = r.lvl === 4;
        return (
          <Appear key={r.lvl} delay={i * 90}>
            <View style={[styles.thermoRow, hot && { backgroundColor: colors.live }]}>
              <ThermoBars level={r.lvl} size={22} onColor={hot ? colors.background : undefined} />
              <Text variant="headline" style={{ flex: 1, fontSize: 20, textTransform: 'uppercase', color: hot ? colors.background : colors.text }}>
                {heatScale[r.lvl].label}
              </Text>
              <Text variant="caption" style={{ color: hot ? colors.background : colors.textSecondary, fontWeight: hot ? '700' : '600' }}>{r.place}</Text>
            </View>
          </Appear>
        );
      })}
    </View>
  );
}

function AskDemo() {
  return (
    <View style={styles.card}>
      <View style={styles.between}>
        <Text variant="caption" tone="secondary">Central 1926</Text>
        <Text variant="caption" tone="secondary">1 de 3</Text>
      </View>
      <Text variant="title">Como tá agora?</Text>
      <View style={styles.grid}>
        {([1, 2, 3, 4] as const).map((l) => {
          const on = l === 3;
          return (
            <View key={l} style={[styles.opt, on && { backgroundColor: heatScale[3].bg }]}>
              <View style={styles.between}>
                <View style={[styles.dot, { backgroundColor: on ? colors.background : heatScale[l].dot }]} />
                {on ? <Check size={18} color={colors.background} strokeWidth={2.6} /> : null}
              </View>
              <Text variant="headline" style={{ color: on ? colors.background : colors.text }}>{heatScale[l].label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function RepDemo() {
  const rows = [
    { k: 'Credibilidade', hint: 'relatos confirmados', v: '94%', p: 0.94, c: colors.live },
    { k: 'Experiência', hint: 'faltam 60 pts', v: 'Nível 5', p: 0.7, c: colors.accentPurple },
    { k: 'Popularidade', hint: 'seguidores', v: '1,2 mil', p: 0.45, c: colors.accent },
  ];
  return (
    <View style={[styles.card, { gap: spacing.lg }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar name="Lia Moreira" seed="lia" size={48} />
        <View>
          <Text variant="headline">lia.noturna</Text>
          <Text variant="caption" tone="secondary">142 relatos desde março</Text>
        </View>
      </View>
      {rows.map((r) => (
        <View key={r.k} style={{ gap: 6 }}>
          <View style={styles.between}>
            <Text variant="caption" tone="secondary" style={{ fontWeight: '600' }}>{r.k}</Text>
            <Text variant="caption" tone="secondary" style={{ fontWeight: '600' }}>{r.hint}</Text>
          </View>
          <Text variant="display" style={{ fontSize: 26, lineHeight: 30 }}>{r.v}</Text>
          <ProgressBar value={r.p} color={r.c} />
        </View>
      ))}
    </View>
  );
}

function LocDemo() {
  const hoods = ['Augusta', 'Pinheiros', 'Barra Funda', 'Vila Madalena', 'Centro', 'Bixiga'];
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
        <View style={styles.iconCircle}><LocateFixed size={20} color={colors.text} /></View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Usar minha localização</Text>
          <Text variant="caption" tone="secondary">Só quando você abre "Perto de você"</Text>
        </View>
      </View>
      <Text variant="caption" tone="secondary" style={{ fontWeight: '600' }}>Ou escolhe o bairro</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {hoods.map((h, i) => (
          <View key={h} style={[styles.chip, i === 0 && { backgroundColor: colors.selected }]}>
            <Text style={{ fontSize: 14, fontWeight: i === 0 ? '700' : '600', color: i === 0 ? colors.onSelected : '#D9D4DE' }}>{h}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

type Step = { art: ReactNode; title: string; body: string };

const STEPS: Step[] = [
  { art: <ThermoDemo />, title: 'De olho no rolê.', body: 'Abre e vê onde tá bom agora. Lotação, vibe e fila contadas por quem tá lá. Relato velho não vale.' },
  { art: <AskDemo />, title: 'Tá no rolê? Conta.', body: 'Três toques e pronto. A gente confirma uma vez que você tá no local, sem rastrear depois.' },
  { art: <RepDemo />, title: 'Construa sua reputação.', body: 'Credibilidade vem da qualidade do que você conta, não de curtida.' },
  { art: <LocDemo />, title: 'Localização só quando você quiser.', body: 'Sem permitir, dá pra escolher o bairro.' },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const [intro, setIntro] = useState(true);
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

  if (intro) {
    // Abertura animada do logo; toque pula.
    return (
      <Pressable style={styles.intro} onPress={() => setIntro(false)} accessibilityRole="button" accessibilityLabel="Pular abertura">
        <FomoIntro width={Math.min(width, 520)} onDone={() => setTimeout(() => setIntro(false), 700)} />
      </Pressable>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.root}>
      <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ gap: spacing.xl }}>
          <View style={styles.progress} accessibilityLabel={`Passo ${i + 1} de ${STEPS.length}`}>
            {STEPS.map((_, idx) => (
              <View key={idx} style={[styles.seg, idx <= i && { backgroundColor: colors.text }]} />
            ))}
          </View>
          <View style={styles.top}>
            <FomoLockup size={24} />
            {!last ? <Button label="Pular" variant="ghost" onPress={finish} /> : <View style={{ height: 54 }} />}
          </View>
          <Animated.View key={i} entering={FadeIn.duration(260)} exiting={FadeOut.duration(120)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {step.art}
          </Animated.View>
        </View>

        <View style={{ gap: spacing.md }} accessibilityLiveRegion="polite">
          <Text variant="brand" accessibilityRole="header">{step.title}</Text>
          <Text tone="secondary" style={styles.body}>{step.body}</Text>
        </View>

        <Button label={last ? 'Começar' : 'Continuar'} fullWidth onPress={() => (last ? finish() : setI(i + 1))} />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  root: { paddingBottom: spacing.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  progress: { flexDirection: 'row', gap: 4, paddingTop: spacing.sm },
  seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surfaceRaised },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -spacing.md },
  body: { fontSize: 17, lineHeight: 24 },
  thermoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 60 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opt: { width: '48.5%', backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, padding: spacing.md, gap: spacing.lg, minHeight: 76 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: 'center' },
});
