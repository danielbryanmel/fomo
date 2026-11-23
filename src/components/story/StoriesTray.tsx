import { router, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { PressableScale } from '@/components/motion/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { storyCache } from '@/features/stories';
import { repositories } from '@/repositories';
import { colors, spacing } from '@/theme';
import type { StoryGroup } from '@/types/domain';

const SIZE = 66;

/** Anel da marca (rosa → magenta → roxo) para quem tem story não visto; cinza para visto. */
function Ring({ unseen }: { unseen: boolean }) {
  return (
    <Svg width={SIZE + 8} height={SIZE + 8} style={StyleSheet.absoluteFill} aria-hidden>
      <Defs>
        <LinearGradient id="sr" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.accentPink} />
          <Stop offset="0.55" stopColor={colors.accent} />
          <Stop offset="1" stopColor={colors.accentPurple} />
        </LinearGradient>
      </Defs>
      <Circle cx={(SIZE + 8) / 2} cy={(SIZE + 8) / 2} r={(SIZE + 8) / 2 - 2} stroke={unseen ? 'url(#sr)' : colors.borderStrong} strokeWidth={unseen ? 3 : 1.5} fill="none" />
    </Svg>
  );
}

/** Bandeja de stories no topo do feed: o seu primeiro (ou "+"), depois quem você segue. */
export function StoriesTray() {
  const auth = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>(storyCache.get());
  const load = useCallback(async () => {
    try {
      const g = await repositories.stories.tray();
      storyCache.set(g);
      setGroups(g);
    } catch {
      /* sem stories (ou banco ainda sem a tabela): a bandeja só some */
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => storyCache.on(() => setGroups(storyCache.get())), []);

  const meId = auth.profile?.id;
  const mine = groups.find((g) => g.author.id === meId);
  const others = groups.filter((g) => g.author.id !== meId);
  if (!auth.profile) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.wrap}>
      <View style={styles.item}>
        <PressableScale
          onPress={() => (mine ? router.push({ pathname: '/story/[id]', params: { id: mine.author.id } }) : router.push('/story/new'))}
          style={styles.bubble} accessibilityRole="button" accessibilityLabel={mine ? 'Ver seu story' : 'Criar story'}>
          {mine ? <Ring unseen={false} /> : null}
          <Avatar name={auth.profile.displayName} url={auth.profile.avatarUrl} seed={auth.profile.id} size={SIZE} />
          {!mine ? <View style={styles.plus}><Plus size={14} color={colors.text} strokeWidth={3} /></View> : null}
        </PressableScale>
        {mine ? (
          <PressableScale onPress={() => router.push('/story/new')} style={styles.plus} accessibilityRole="button" accessibilityLabel="Adicionar outro story">
            <Plus size={14} color={colors.text} strokeWidth={3} />
          </PressableScale>
        ) : null}
        <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.name}>Seu story</Text>
      </View>
      {others.map((g) => (
        <View key={g.author.id} style={styles.item}>
          <PressableScale onPress={() => router.push({ pathname: '/story/[id]', params: { id: g.author.id } })} style={styles.bubble}
            accessibilityRole="button" accessibilityLabel={`Story de ${g.author.displayName}${g.hasUnseen ? ', novo' : ''}`}>
            <Ring unseen={g.hasUnseen} />
            <Avatar name={g.author.displayName} url={g.author.avatarUrl} seed={g.author.id} size={SIZE} />
          </PressableScale>
          <Text variant="caption" tone={g.hasUnseen ? 'primary' : 'secondary'} numberOfLines={1} style={styles.name}>{g.author.username}</Text>
        </View>
      ))}
      {!others.length ? (
        <View style={styles.empty}>
          <Text variant="caption" tone="muted">Stories de quem você segue aparecem aqui por 24 h.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: -spacing.lg },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md, alignItems: 'flex-start' },
  item: { width: SIZE + 8, alignItems: 'center', gap: 6 },
  bubble: { width: SIZE + 8, height: SIZE + 8, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', right: 0, top: SIZE - 18, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accentPink, borderWidth: 2, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  name: { maxWidth: SIZE + 8, textAlign: 'center' },
  empty: { justifyContent: 'center', height: SIZE + 8, maxWidth: 200 },
});
