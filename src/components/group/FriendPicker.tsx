import { Check, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { PersonRow } from '@/components/profile/PersonRow';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { UserProfile } from '@/types/domain';

/** Escolher amigos: começa por quem você segue; busca qualquer @. */
export function FriendPicker({ selected, onToggle, exclude = [] }: { selected: string[]; onToggle: (p: UserProfile) => void; exclude?: string[] }) {
  const auth = useAuth();
  const [base, setBase] = useState<UserProfile[]>([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<UserProfile[] | null>(null);

  useEffect(() => {
    void repositories.profiles.me()
      .then((v) => repositories.profiles.following(v.profile.id))
      .then(setBase)
      .catch(() => setBase([]));
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setFound(null);
      return;
    }
    const t = setTimeout(() => void repositories.profiles.search(q).then(setFound).catch(() => setFound([])), 280);
    return () => clearTimeout(t);
  }, [q]);

  const list = useMemo(() => (found ?? base).filter((p) => !exclude.includes(p.id) && p.id !== auth.profile?.id), [found, base, exclude, auth.profile?.id]);

  return (
    <View style={styles.wrap}>
      <View style={styles.search}>
        <Search size={16} color={colors.textMuted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar @ ou nome" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input} accessibilityLabel="Buscar amigos" />
      </View>
      {!found && base.length === 0 ? <Text variant="caption" tone="muted">Você ainda não segue ninguém — busque pelo @.</Text> : null}
      {list.map((p) => {
        const on = selected.includes(p.id);
        return (
          <PersonRow
            key={p.id}
            person={p}
            onPress={() => onToggle(p)}
            right={
              <Pressable onPress={() => onToggle(p)} style={[styles.check, on && styles.checkOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Convidar @${p.username}`}>
                {on ? <Check size={16} color={colors.text} /> : null}
              </Pressable>
            }
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  input: { flex: 1, color: colors.text, fontSize: 16, outlineStyle: 'none' as never },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accentPink, borderColor: colors.accentPink },
});
