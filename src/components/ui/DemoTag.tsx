import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';
import { Text } from './Text';

/** Selo para conteúdo de demonstração do beta — nunca deixar parecer real. */
export function DemoTag({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <View style={styles.tag} accessibilityLabel="Conteúdo de demonstração">
      <Text variant="mono" style={styles.txt}>demo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong, alignSelf: 'center' },
  txt: { fontSize: 11, lineHeight: 14, color: colors.textSecondary },
});
