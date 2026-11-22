import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ban, Flag, MoreHorizontal, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { ActionSheet, Button, IconButton, Screen, Skeleton, StateView, useToast } from '@/components/ui';
import { ProfileView } from '@/features/profile/ProfileView';
import { useAsync } from '@/hooks/useAsync';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';
import { View } from 'react-native';

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const toast = useToast();
  const profile = useAsync(() => repositories.profiles.getByUsername(username), [username]);
  const [menu, setMenu] = useState<'none' | 'menu' | 'block'>('none');
  const [busy, setBusy] = useState(false);

  if (profile.loading && !profile.data) {
    return (
      <Screen>
        <View style={{ gap: spacing.md, paddingTop: spacing.xl }}>
          <Skeleton width={76} height={76} rounded={radius.pill} />
          <Skeleton width="50%" height={22} />
          <Skeleton height={72} rounded={radius.md} />
        </View>
      </Screen>
    );
  }
  if (profile.error) return <Screen><StateView tone="error" title="Não foi possível carregar" actionLabel="Tentar de novo" onAction={profile.refresh} /></Screen>;
  if (!profile.data) {
    return <Screen><StateView icon={<UserX size={26} color={colors.textSecondary} />} title="Perfil não encontrado" description={`Não existe ninguém com @${username}.`} /></Screen>;
  }

  const { profile: p, relationship: rel } = profile.data;

  async function toggleFollow() {
    setBusy(true);
    try {
      const status = await repositories.profiles.toggleFollow(p.id);
      await profile.refresh();
      toast(status === 'pending' ? 'Solicitação enviada' : status === 'accepted' ? `Seguindo @${p.username}` : 'Você deixou de seguir', 'success');
    } catch {
      toast('Não foi possível concluir agora.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    try {
      await repositories.profiles.report(p.id, 'outro');
      toast('Denúncia enviada. Obrigado por avisar.', 'success');
    } catch {
      toast('Não foi possível denunciar agora.', 'error');
    }
  }

  async function block() {
    try {
      await repositories.profiles.block(p.id);
      toast(`@${p.username} bloqueado`, 'success');
      if (router.canGoBack()) router.back();
      else await profile.refresh();
    } catch {
      toast('Não foi possível bloquear agora.', 'error');
    }
  }

  async function unblock() {
    try {
      await repositories.profiles.unblock(p.id);
      await profile.refresh();
      toast('Desbloqueado');
    } catch {
      toast('Não foi possível desbloquear agora.', 'error');
    }
  }

  const followLabel = rel.followStatus === 'accepted' ? 'Seguindo' : rel.followStatus === 'pending' ? 'Solicitado' : rel.followsViewer ? 'Seguir de volta' : 'Seguir';

  return (
    <Screen bleed edges={[]}>
      <Stack.Screen
        options={{
          title: `@${p.username}`,
          headerRight: () => (
            <IconButton label="Mais opções" icon={<MoreHorizontal size={20} color={colors.text} />} onPress={() => setMenu('menu')} />
          ),
        }}
      />
      <ProfileView
        data={profile.data}
        onRefresh={profile.refresh}
        actions={
          rel.isSelf ? null : (
            <Button
              label={followLabel}
              variant={rel.followStatus ? 'secondary' : 'primary'}
              loading={busy}
              onPress={toggleFollow}
              fullWidth
              accessibilityHint={p.isPrivate && !rel.followStatus ? 'Perfil privado: a pessoa precisa aprovar' : undefined}
            />
          )
        }
      />
      <ActionSheet
        visible={menu === 'menu'}
        onClose={() => setMenu('none')}
        title={`@${p.username}`}
        actions={rel.isSelf ? [] : [
          { label: 'Denunciar perfil', destructive: true, icon: <Flag size={18} color={colors.danger} />, onPress: () => void report() },
          rel.isBlocked
            ? { label: 'Desbloquear', icon: <Ban size={18} color={colors.text} />, onPress: () => void unblock() }
            : { label: 'Bloquear', destructive: true, icon: <Ban size={18} color={colors.danger} />, onPress: () => setMenu('block') },
        ]}
      />
      <ActionSheet
        visible={menu === 'block'}
        onClose={() => setMenu('none')}
        title={`Bloquear @${p.username}?`}
        message="Vocês deixam de se seguir e não veem mais o conteúdo um do outro. A pessoa não é avisada."
        actions={[{ label: 'Bloquear', destructive: true, onPress: () => void block() }]}
      />
    </Screen>
  );
}
