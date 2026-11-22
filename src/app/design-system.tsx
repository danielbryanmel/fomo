import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { BadgeCheck, Flame, Users } from 'lucide-react-native';
import { FomoMark } from '@/components/brand/FomoMark';
import { Button, Card, Chip, Screen, Skeleton, Text } from '@/components/ui';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { levelProgress } from '@/config/levels';
import { colors, radius, spacing, typography, type TypographyVariant } from '@/theme';

const SWATCHES = [
  ['background', colors.background],
  ['surface', colors.surface],
  ['surfaceRaised', colors.surfaceRaised],
  ['border', colors.border],
  ['accentPink', colors.accentPink],
  ['accent', colors.accent],
  ['accentPurple', colors.accentPurple],
] as const;

/** Vitrine de tokens e componentes — só em desenvolvimento. */
export default function DesignSystemScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  const demo = levelProgress(420);

  return (
    <Screen scroll edges={['bottom']} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.marks}>
          <FomoMark size={72} variant="glass" />
          <FomoMark size={72} />
          <FomoMark size={72} variant="white" />
        </View>
        <Text variant="caption" tone="muted">Símbolo oficial · Identidade V4 — "O olhar que escapa"</Text>
      </View>

      <Section title="Cores">
        <View style={styles.swatches}>
          {SWATCHES.map(([name, hex]) => (
            <View key={name} style={styles.swatch}>
              <View style={[styles.swatchColor, { backgroundColor: hex }]} />
              <Text variant="caption">{name}</Text>
              <Text variant="caption" tone="muted">{hex}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Tipografia">
        {(Object.keys(typography) as TypographyVariant[]).map((v) => (
          <Text key={v} variant={v}>{v} — Rolê bom é rolê compartilhado</Text>
        ))}
      </Section>

      <Section title="Ações">
        <Button label="Publicar rolê" />
        <Button label="Seguir" variant="secondary" />
        <Button label="Cancelar" variant="ghost" />
        <Button label="Denunciar" variant="danger" />
        <Button label="Carregando" loading />
        <View style={styles.chips}>
          {['Tudo', 'Festas', 'Bares', 'Shows', 'Geek'].map((c, i) => (
            <Chip key={c} label={c} selected={i === 0} />
          ))}
        </View>
      </Section>

      <Section title="Sinais separados (decisão V2)">
        <Card>
          <View style={styles.signals}>
            <Signal icon={<Users size={18} color={colors.signal.popularity} />} label="Popularidade" value="1,2 mil seguidores" />
            <Signal icon={<Flame size={18} color={colors.signal.experience} />} label="Experiência" value={`Nv ${demo.current.level} · ${demo.current.name}`} />
            <Signal icon={<BadgeCheck size={18} color={colors.signal.credibility} />} label="Credibilidade" value="72/100" />
          </View>
          <View style={styles.progress}>
            <Text variant="caption" tone="secondary">
              420 XP · próximo: {demo.next?.name}
            </Text>
            <ProgressBar value={demo.progress} accessibilityLabel="Progresso para o próximo nível" />
          </View>
        </Card>
      </Section>

      <Section title="Carregamento">
        <Card>
          <View style={styles.skeletonRow}>
            <Skeleton width={44} height={44} rounded={radius.pill} />
            <View style={styles.skeletonLines}>
              <Skeleton width="60%" />
              <Skeleton width="35%" height={12} />
            </View>
          </View>
          <View style={styles.progress}>
            <Skeleton height={180} rounded={radius.md} />
          </View>
        </Card>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="muted">{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Signal({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.signal}>
      {icon}
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="caption">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.xl, gap: spacing.xxl },
  center: { alignItems: 'center', gap: spacing.sm },
  marks: { flexDirection: 'row', gap: spacing.xl },
  section: { gap: spacing.md },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: { width: 96, gap: spacing.xxs },
  swatchColor: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  signals: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  signal: { flex: 1, gap: spacing.xxs },
  progress: { marginTop: spacing.lg, gap: spacing.xs },
  skeletonRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  skeletonLines: { flex: 1, gap: spacing.sm },
});
