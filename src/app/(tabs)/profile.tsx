import { router } from 'expo-router';
import { MoonStar, Palette, Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Screen, Skeleton, StateView } from '@/components/ui';
import { ProfileView } from '@/features/profile/ProfileView';
import { useAsync } from '@/hooks/useAsync';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { repositories } from '@/repositories';
import { colors, radius, spacing } from '@/theme';

export default function MyProfileScreen() {
  const me = useAsync(() => repositories.profiles.me(), []);
  // volta das configurações já atualizado
  const first = useRef(true);
  const refresh = me.refresh;
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    void refresh();
  }, [refresh]));

  if (me.loading && !me.data) {
    return (
      <Screen>
        <View style={styles.skeleton}>
          <Skeleton width={76} height={76} rounded={radius.pill} />
          <Skeleton width="50%" height={22} />
          <Skeleton width="80%" />
          <Skeleton height={72} rounded={radius.md} />
        </View>
      </Screen>
    );
  }
  if (me.error || !me.data) {
    return (
      <Screen>
        <StateView tone="error" title="Não foi possível carregar seu perfil" actionLabel="Tentar de novo" onAction={me.refresh} />
      </Screen>
    );
  }

  return (
    <Screen bleed>
      <View style={styles.topBar}>
        {__DEV__ ? (
          <IconButton label="Design system" icon={<Palette size={20} color={colors.textMuted} />} onPress={() => router.push('/design-system')} />
        ) : null}
        <IconButton label="Configurações" icon={<Settings size={20} color={colors.textSecondary} />} onPress={() => router.push('/settings')} />
      </View>
      <ProfileView
        data={me.data}
        onRefresh={me.refresh}
        actions={
          <View style={styles.actions}>
            <View style={styles.flex}><Button label="Editar perfil" variant="secondary" fullWidth onPress={() => router.push('/settings')} /></View>
            {me.data ? (
              <View style={styles.flex}>
                <Button label="Minha noite" variant="secondary" fullWidth icon={<MoonStar size={16} color={colors.text} />}
                  onPress={() => router.push({ pathname: '/recap/[username]', params: { username: me.data!.profile.username } })} />
              </View>
            ) : null}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.sm },
  skeleton: { gap: spacing.md, paddingTop: spacing.xxl },
});
