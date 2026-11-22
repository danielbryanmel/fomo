import { BadgeCheck, MessageSquareQuote } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { PresenceState } from '@/types/domain';

/**
 * Decisão V2 — três estados distintos e nunca confundidos:
 *  - none     → nada é exibido (a publicação não afirma presença)
 *  - declared → "Disse que esteve" (neutro, sem selo de verificação)
 *  - verified → "Presença confirmada" (selo verde)
 */
export function PresenceBadge({ presence }: { presence: PresenceState }) {
  if (presence === 'none') return null;
  const verified = presence === 'verified';
  return (
    <View
      style={[styles.badge, verified && styles.verified]}
      accessibilityLabel={verified ? 'Presença confirmada por validação' : 'Presença declarada pelo autor, não confirmada'}
    >
      {verified ? (
        <BadgeCheck size={14} color={colors.success} />
      ) : (
        <MessageSquareQuote size={14} color={colors.textMuted} />
      )}
      <Text variant="label" tone={verified ? 'primary' : 'muted'}>
        {verified ? 'Presença confirmada' : 'Disse que esteve'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verified: { borderColor: 'rgba(52,199,123,0.45)' },
});
