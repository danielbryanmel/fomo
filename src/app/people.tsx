import { Search, UserSearch, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Appear } from '@/components/motion';
import { PersonRow } from '@/components/profile/PersonRow';
import { FollowButton } from '@/components/profile/Suggestions';
import { useAsync } from '@/hooks/useAsync';
import { Screen, StateView, Text } from '@/components/ui';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import type { UserProfile } from '@/types/domain';

/** Buscar pessoas por @ ou nome. Perfis privados aparecem (nome, @, nível), conteúdo não. */
export default function PeopleScreen() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UserProfile[] | null>(null);
  const suggestions = useAsync(() => repositories.profiles.suggestions(30).catch(() => []), []);

  useEffect(() => {
    const term = q.trim();
    if (term.replace(/^@/, '').length < 2) {
      setResults(null);
      return;
    }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await repositories.profiles.search(term);
        if (alive) setResults(r);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setBusy(false);
      }
    }, 280);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <Screen edges={['bottom']}>
      <View style={styles.search}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por @ ou nome"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="Buscar pessoas"
        />
        {busy ? <ActivityIndicator size="small" color={colors.textMuted} /> : q ? (
          <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Limpar busca"><X size={18} color={colors.textMuted} /></Pressable>
        ) : null}
      </View>

      {results === null && suggestions.data?.length ? (
        <FlatList
          data={suggestions.data}
          keyExtractor={(s) => s.profile.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <Appear index={index < 8 ? index : 0}>
              <PersonRow person={item.profile} subtitle={item.reason} right={<FollowButton userId={item.profile.id} />} />
            </Appear>
          )}
          ListHeaderComponent={<Text variant="mono" tone="muted" style={styles.count}>sugestões para você</Text>}
        />
      ) : results === null ? (
        <StateView icon={<UserSearch size={26} color={colors.textSecondary} />} title="Encontre a galera" description="Digite pelo menos 2 letras do @ ou do nome." />
      ) : results.length === 0 && !busy ? (
        <StateView title="Ninguém encontrado" description={`Nenhum perfil com “${q.trim()}”.`} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <PersonRow person={item} subtitle={`${item.followersCount} seguidores`} />
            </Appear>
          )}
          ListHeaderComponent={<Text variant="mono" tone="muted" style={styles.count}>{results.length} {results.length === 1 ? 'pessoa' : 'pessoas'}</Text>}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 48,
    borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.md,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, outlineStyle: 'none' as never, paddingVertical: spacing.sm },
  count: { marginBottom: spacing.sm },
});
