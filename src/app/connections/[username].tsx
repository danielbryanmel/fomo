import { Stack, useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Appear } from '@/components/motion';
import { PersonRow } from '@/components/profile/PersonRow';
import { ActionSheet, Button, Screen, SegmentedTabs, Skeleton, StateView, useToast } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, spacing } from '@/theme';
import type { UserProfile } from '@/types/domain';

type Tab = 'followers' | 'following';

/** Seguidores / seguindo. No MEU perfil: deixar de seguir e remover seguidor. */
export default function ConnectionsScreen() {
  const { username, tab: initial } = useLocalSearchParams<{ username: string; tab?: Tab }>();
  const auth = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(initial === 'following' ? 'following' : 'followers');
  const [confirm, setConfirm] = useState<{ kind: 'unfollow' | 'remove'; person: UserProfile } | null>(null);

  const owner = useAsync(() => repositories.profiles.getByUsername(username), [username]);
  const ownerId = owner.data?.profile.id;
  const list = useAsync(
    () => (ownerId ? (tab === 'followers' ? repositories.profiles.followers(ownerId) : repositories.profiles.following(ownerId)) : Promise.resolve([])),
    [ownerId, tab],
  );
  const isMine = !!owner.data?.relationship.isSelf || (auth.profile?.username === username);
  const canSee = owner.data ? owner.data.relationship.canViewContent : true;

  async function run() {
    if (!confirm) return;
    const { kind, person } = confirm;
    setConfirm(null);
    try {
      if (kind === 'unfollow') await repositories.profiles.toggleFollow(person.id);
      else await repositories.profiles.removeFollower(person.id);
      list.setData((l) => l?.filter((p) => p.id !== person.id));
      toast(kind === 'unfollow' ? `Você deixou de seguir @${person.username}` : `@${person.username} não te segue mais`, 'success');
    } catch {
      toast('Não foi possível concluir agora.', 'error');
    }
  }

  return (
    <Screen bleed edges={['bottom']}>
      <Stack.Screen options={{ title: `@${username}` }} />
      <SegmentedTabs tabs={[{ key: 'followers', label: 'Seguidores' }, { key: 'following', label: 'Seguindo' }]} value={tab} onChange={setTab} />
      {!canSee ? (
        <StateView title="Perfil privado" description="Siga e espere a aprovação para ver quem a pessoa segue." />
      ) : list.loading && !list.data ? (
        <View style={styles.pad}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={52} />)}</View>
      ) : (list.data ?? []).length === 0 ? (
        <StateView icon={<Users size={26} color={colors.textSecondary} />} title={tab === 'followers' ? 'Ainda sem seguidores' : 'Ainda não segue ninguém'} />
      ) : (
        <FlatList
          data={list.data}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.pad}
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <PersonRow
                person={item}
                right={
                  isMine ? (
                    <Button
                      label={tab === 'following' ? 'Seguindo' : 'Remover'}
                      variant="secondary"
                      onPress={() => setConfirm({ kind: tab === 'following' ? 'unfollow' : 'remove', person: item })}
                    />
                  ) : undefined
                }
              />
            </Appear>
          )}
        />
      )}
      <ActionSheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'unfollow' ? `Deixar de seguir @${confirm.person.username}?` : `Remover @${confirm?.person.username} dos seguidores?`}
        message={confirm?.kind === 'remove' ? 'A pessoa não é avisada. Se seu perfil for privado, ela precisa pedir de novo.' : undefined}
        actions={[{ label: confirm?.kind === 'unfollow' ? 'Deixar de seguir' : 'Remover', destructive: true, onPress: () => void run() }]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ pad: { padding: spacing.lg, gap: spacing.xs } });
