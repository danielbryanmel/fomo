import { PressableScale } from '@/components/motion/PressableScale';
import { Link, router } from 'expo-router';
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
          <Text variant="mono" tone="secondary">{profile.xp.toLocaleString('pt-BR')}{next ? ` / ${next.minXp.toLocaleString('pt-BR')}` : ''} XP</Text>
        </View>
        <Text variant="display">{current.name}</Text>
        <ProgressBar value={progress} height={5} />
        <Text variant="caption" tone="secondary">{next ? `Faltam ${next.minXp - profile.xp} XP para ${next.name}.` : 'Nível máximo.'}</Text>
      </View>

      {/* Números: rolês · avaliações · seguidores · credibilidade */}
      <View style={styles.tiles}>
        <Tile value={formatCount(profile.totalExperiences)} label="rolês" />
        <Tile value={formatCount(profile.followersCount)} label="seguidores"
          onPress={() => router.push({ pathname: '/connections/[username]', params: { username: profile.username, tab: 'followers' } })} />
        <Tile value={formatCount(profile.followingCount)} label="seguindo"
          onPress={() => router.push({ pathname: '/connections/[username]', params: { username: profile.username, tab: 'following' } })} />
        <Link href="/reputation" asChild>
          <Pressable style={StyleSheet.flatten([styles.tile, styles.credTile])} accessibilityRole="link" accessibilityLabel={`Credibilidade ${Math.round(profile.credibilityScore)} de 100. Ver como é calculada`}>
            <View style={styles.credTop}>
              <Text variant="title" style={{ color: colors.signal.credibility }}>{Math.round(profile.credibilityScore)}</Text>
              <Info size={12} color={colors.textMuted} />
            </View>
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.tileLabel}>credibilidade</Text>
          </Pressable>
        </Link>
      </View>

      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

function Tile({ value, label, onPress }: { value: string; label: string; onPress?: () => void }) {
  const body = (
    <>
      <Text variant="title">{value}</Text>
      <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.tileLabel}>{label}</Text>
    </>
  );
  return onPress ? (
    <PressableScale style={styles.tile} onPress={onPress} scaleTo={0.95} accessibilityRole="link" accessibilityLabel={`${value} ${label}. Ver lista`}>{body}</PressableScale>
  ) : (
    <View style={styles.tile} accessible accessibilityLabel={`${value} ${label}`}>{body}</View>
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
    backgroundColor: colors.surface,
  },
  levelTop: { flexDirection: 'row', justifyContent: 'space-between' },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, gap: 2, paddingVertical: spacing.xs },
  tileLabel: { fontSize: 13, lineHeight: 16 },
  credTile: { flex: 1.3 },
  credTop: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
