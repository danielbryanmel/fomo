import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { DemoTag } from '@/components/ui/DemoTag';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';
import type { UserProfile } from '@/types/domain';
import { LevelBadge } from './LevelBadge';

/** Linha de pessoa (busca, seguidores, convites). Toque abre o perfil; `right` para ações. */
export function PersonRow({ person, right, subtitle, onPress }: { person: UserProfile; right?: ReactNode; subtitle?: string; onPress?: () => void }) {
  return (
    <View style={styles.row}>
      <PressableScale
        style={styles.who}
        scaleTo={0.98}
        onPress={onPress ?? (() => router.push({ pathname: '/u/[username]', params: { username: person.username } }))}
        accessibilityRole="link"
        accessibilityLabel={`${person.displayName}, @${person.username}`}
      >
        <Avatar name={person.displayName} url={person.avatarUrl} seed={person.id} size={44} />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>{person.displayName}</Text>
            <LevelBadge level={person.level} />
            <DemoTag show={!!person.isDemo} />
          </View>
          <Text variant="mono" tone="muted" numberOfLines={1}>@{person.username}{subtitle ? ` · ${subtitle}` : ''}</Text>
        </View>
      </PressableScale>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.md },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shrink: { flexShrink: 1 },
});

export const personRowDivider = { height: StyleSheet.hairlineWidth, backgroundColor: colors.border };
