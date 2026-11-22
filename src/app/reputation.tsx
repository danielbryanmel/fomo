import { BadgeCheck, Flame, Users } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Screen, Text } from '@/components/ui';
import { LEVELS } from '@/config/levels';
import { colors, radius, spacing } from '@/theme';

const FACTORS = [
  ['Avaliações úteis', 'Quantas pessoas, de contas diferentes e confiáveis, marcaram suas avaliações como úteis.'],
  ['Consistência', 'Contribuições regulares ao longo do tempo, sem picos suspeitos.'],
  ['Histórico de moderação', 'Conteúdo removido por violar regras reduz a pontuação.'],
  ['Diversidade', 'Experiências em lugares e categorias diferentes.'],
  ['Presença confirmada', 'Check-ins validados (código do organizador, QR). Presença só declarada não conta.'],
] as const;

/** Tela de transparência — decisão V2: credibilidade explicada ao usuário. */
export default function ReputationScreen() {
  return (
    <Screen scroll edges={['bottom']} contentStyle={styles.content}>
      <Text tone="secondary">
        No FOMO, três sinais diferentes aparecem no seu perfil. Um não substitui o outro.
      </Text>

      <Signal icon={<Users size={20} color={colors.signal.popularity} />} title="Popularidade" body="Seguidores e curtidas. Mostra alcance — não qualidade." />
      <Signal icon={<Flame size={20} color={colors.signal.experience} />} title="Experiência" body="XP e nível, ganhos por contribuições legítimas, com limite diário por tipo de ação para impedir farming." />
      <Signal icon={<BadgeCheck size={20} color={colors.signal.credibility} />} title="Credibilidade (0–100)" body="Calculada no servidor por regras documentadas. Não pode ser comprada e não usa número de seguidores nem curtidas." />

      <Text variant="headline" style={styles.h}>O que entra na credibilidade</Text>
      {FACTORS.map(([t, d]) => (
        <View key={t} style={styles.factor}>
          <Text variant="bodyStrong">{t}</Text>
          <Text tone="secondary">{d}</Text>
        </View>
      ))}

      <Text variant="headline" style={styles.h}>Níveis</Text>
      <Card style={styles.levels}>
        {LEVELS.map((l) => (
          <View key={l.level} style={styles.level}>
            <View style={styles.levelNum}><Text variant="label">{l.level}</Text></View>
            <Text style={styles.flex}>{l.name}</Text>
            <Text variant="caption" tone="muted">{l.minXp} XP</Text>
          </View>
        ))}
      </Card>
      <Text variant="caption" tone="muted">Valores de XP iniciais, configuráveis no servidor e sujeitos a ajuste.</Text>
    </Screen>
  );
}

function Signal({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Card style={styles.signal}>
      {icon}
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text tone="secondary">{body}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.lg, gap: spacing.md },
  h: { marginTop: spacing.md },
  signal: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  factor: { gap: spacing.xxs },
  levels: { gap: spacing.md },
  level: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  levelNum: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: 'rgba(138,54,232,0.18)', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
