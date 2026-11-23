import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Appear, PressableScale } from '@/components/motion';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';
import type { UserProfile } from '@/types/domain';

/** "Quem tá indo": avatares sobrepostos + nomes de quem você segue e vai ao rolê. */
export function FriendsGoing({ people }: { people: UserProfile[] }) {
  if (!people.length) return null;
  const shown = people.slice(0, 5);
  const names = people.slice(0, 2).map((p) => p.username).join(', ');
  const rest = people.length - 2;
  const label = rest > 0 ? `${names} e mais ${rest} ${rest === 1 ? 'pessoa' : 'pessoas'} que você segue vão` : `${names} ${people.length === 1 ? 'vai' : 'vão'}`;
  return (
    <Appear>
      <PressableScale style={styles.root} scaleTo={0.98}
        onPress={() => router.push({ pathname: '/u/[username]', params: { username: people[0]!.username } })}
        accessibilityRole="button" accessibilityLabel={label}>
        <View style={styles.stack}>
          {shown.map((p, i) => (
            <View key={p.id} style={[styles.ring, { marginLeft: i ? -12 : 0, zIndex: shown.length - i }]}>
              <Avatar name={p.displayName} url={p.avatarUrl} seed={p.id} size={30} />
            </View>
          ))}
        </View>
        <View style={styles.flex}>
          <Text variant="mono" tone="muted">quem tá indo</Text>
          <Text variant="body" numberOfLines={2}>{label}</Text>
        </View>
      </PressableScale>
    </Appear>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(232,54,140,0.35)' },
  stack: { flexDirection: 'row' },
  ring: { borderRadius: 18, borderWidth: 2, borderColor: colors.surface },
  flex: { flex: 1, gap: 2 },
});
