import { router } from 'expo-router';
import { EyeOff, MapPinCheck, Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Appear, PressableScale } from '@/components/motion';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';
import type { EventPresence } from '@/types/domain';

const VIS_LABEL = { public: 'público', friends: 'só amigos', followers: 'seguidores', private: 'anônimo' } as const;

/** Número de check-ins (agregado) + o meu check-in, com atalho para fazer/editar. */
export function PresenceRow({ eventId, presence }: { eventId: string; presence: EventPresence | null }) {
  const me = presence?.me ?? null;
  const hiddenUntil = me?.revealAt && new Date(me.revealAt).getTime() > Date.now() ? new Date(me.revealAt) : null;
  const crowd = presence?.count ? `${presence.count} pessoas fizeram check-in` : presence?.few ? 'Os primeiros já chegaram' : 'Ninguém fez check-in ainda';
  const open = () => router.push({ pathname: '/checkin/[id]', params: { id: eventId } });
  return (
    <Appear>
      <PressableScale style={[styles.root, me && styles.mine]} scaleTo={0.98} onPress={open} accessibilityRole="button"
        accessibilityLabel={me ? `Você fez check-in, ${VIS_LABEL[me.visibility]}. Editar.` : `${crowd}. Fazer check-in.`}>
        <View style={[styles.icon, me && styles.iconMine]}>
          {me?.visibility === 'private' ? <EyeOff size={20} color={colors.text} /> : me ? <MapPinCheck size={20} color={colors.text} /> : <Users size={20} color={colors.text} />}
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{me ? 'Você está aqui' : crowd}</Text>
          <Text variant="caption" tone="secondary">
            {me
              ? `${VIS_LABEL[me.visibility]}${hiddenUntil ? ` · aparece às ${hiddenUntil.getHours()}h${String(hiddenUntil.getMinutes()).padStart(2, '0')}` : ''}${presence?.count ? ` · ${presence.count} no rolê` : ''}`
              : 'Faça check-in: público, só amigos ou anônimo'}
          </Text>
        </View>
        <Text variant="mono" tone="primary">{me ? 'editar' : 'check-in'}</Text>
      </PressableScale>
    </Appear>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 64, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  mine: { borderColor: 'rgba(232,54,140,0.45)' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  iconMine: { backgroundColor: 'rgba(232,54,140,0.28)' },
  flex: { flex: 1, gap: 2 },
});
