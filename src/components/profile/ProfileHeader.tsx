import { Link } from 'expo-router';
import { DemoTag } from '@/components/ui/DemoTag';
import { Info, Lock } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, ProgressBar, Text } from '@/components/ui';
import { levelProgress } from '@/config/levels';
import { formatCount } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';
import type { UserProfile } from '@/types/domain';

type Props = { profile: UserProfile; actions?: ReactNode };

/**
 * Cabeçalho do perfil (linguagem v2).
 * Três sinais SEPARADOS (decisão V2):
 *  - Experiência → cartão de nível com XP e progresso;
 *  - Credibilidade → bloco próprio, com link "como calculamos";
 *  - Popularidade → seguidores, no mesmo peso visual que os demais números (não é destaque).
 */
export function ProfileHeader({ profile, actions }: Props) {
  const { current, next, progress } = levelProgress(profile.xp);
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Avatar name={profile.displayName} url={profile.avatarUrl} seed={profile.id} size={64} />
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text variant="title" numberOfLines={1} style={styles.shrink}>{profile.displayName}</Text>
            <DemoTag show={!!profile.isDemo} />
            {profile.isPrivate ? <Lock size={16} color={colors.textMuted} accessibilityLabel="Perfil privado" /> : null}
          </View>
          <Text variant="mono" tone="muted">@{profile.username}</Text>
        </View>
      </View>

      {profile.bio ? <Text tone="secondary">{profile.bio}</Text> : null}

      {/* Experiência */}
      <View style={styles.levelCard} accessible accessibilityLabel={`Nível ${current.level}, ${current.name}. ${profile.xp} XP.${next ? ` Faltam ${next.minXp - profile.xp} XP para ${next.name}.` : ''}`}>
        <View style={styles.levelTop}>
          <Text variant="mono" tone="muted">nível {current.level}</Text>
          <Text variant="mono" tone="live">{profile.xp.toLocaleString('pt-BR')}{next ? ` / ${next.minXp.toLocaleString('pt-BR')}` : ''} xp</Text>
        </View>
        <Text variant="display">{current.name}</Text>
        <ProgressBar value={progress} height={5} />
        <Text variant="caption" tone="secondary">{next ? `Faltam ${next.minXp - profile.xp} XP para ${next.name}.` : 'Nível máximo.'}</Text>
      </View>

      {/* Números: rolês · avaliações · seguidores · credibilidade */}
      <View style={styles.tiles}>
        <Tile value={formatCount(profile.totalExperiences)} label="rolês" />
        <Tile value={formatCount(profile.totalReviews)} label="avaliações" />
        <Tile value={formatCount(profile.followersCount)} label="seguidores" />
        <Link href="/reputation" asChild>
          <Pressable style={StyleSheet.flatten([styles.tile, styles.credTile])} accessibilityRole="link" accessibilityLabel={`Credibilidade ${Math.round(profile.credibilityScore)} de 100. Ver como é calculada`}>
            <View style={styles.credTop}>
              <Text variant="headline" style={{ color: colors.signal.credibility }}>{Math.round(profile.credibilityScore)}</Text>
              <Info size={12} color={colors.textMuted} />
            </View>
            <Text variant="caption" tone="muted" numberOfLines={1} style={styles.tileLabel}>credib.</Text>
          </Pressable>
        </Link>
      </View>

      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="headline">{value}</Text>
      <Text variant="caption" tone="muted" numberOfLines={1} style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg, paddingVertical: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  identity: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shrink: { flexShrink: 1 },
  levelCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(28,24,34,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  levelTop: { flexDirection: 'row', justifyContent: 'space-between' },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, gap: 2, paddingVertical: spacing.md, paddingHorizontal: spacing.sm + 2, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tileLabel: { fontSize: 11, lineHeight: 14 },
  credTile: { borderColor: 'rgba(52,199,123,0.3)' },
  credTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
