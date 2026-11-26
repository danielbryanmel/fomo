import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { CROWD_LABEL } from '@/config/live';
import { colors, heatScale } from '@/theme';
import type { CrowdLevel } from '@/types/domain';

/** Etiqueta de lotação (GUIA .fomo-status): cor fixa do termômetro, mesma em mapa, lista, feed, story e grupos. */
export function CrowdPill({ level, size = 'md' }: { level: CrowdLevel | null; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 22 : 24;
  if (!level) {
    return (
      <View style={[styles.pill, { height: h, backgroundColor: colors.surfaceRaised }]}>
        <Text style={[styles.t, { color: colors.textMuted }]}>Sem relatos</Text>
      </View>
    );
  }
  const s = heatScale[level];
  return (
    <View style={[styles.pill, { height: h, backgroundColor: s.bg }]} accessibilityLabel={`Lotação: ${CROWD_LABEL[level]}`}>
      <Text style={[styles.t, { color: s.fg }]}>{CROWD_LABEL[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 6, paddingHorizontal: 8, alignSelf: 'flex-start', justifyContent: 'center' },
  t: { fontSize: 12, lineHeight: 15, fontWeight: '800' },
});
