import { StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { colors } from '@/theme';
import type { UserProfile } from '@/types/domain';

/** Dois rostos sobrepostos para conversa em grupo. */
export function GroupAvatar({ members, size = 48 }: { members: UserProfile[]; size?: number }) {
  const [a, b] = members;
  const s = Math.round(size * 0.68);
  if (!a) return <Avatar name="Grupo" url={null} seed="grupo" size={size} />;
  if (!b) return <Avatar name={a.displayName} url={a.avatarUrl} seed={a.id} size={size} />;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden>
      <View style={styles.back}><Avatar name={a.displayName} url={a.avatarUrl} seed={a.id} size={s} /></View>
      <View style={[styles.front, { borderRadius: s }]}><Avatar name={b.displayName} url={b.avatarUrl} seed={b.id} size={s} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', top: 0, left: 0 },
  front: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2, borderColor: colors.background },
});
