import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { FomoMark } from './FomoMark';

/**
 * Símbolo + "fomo".
 * ⚠️ O wordmark oficial não foi recebido (aparece só no vídeo de conceito). Até chegar o
 * vetor, o nome usa a fonte do sistema em peso 800 — trocar aqui quando houver o arquivo.
 */
export function FomoLockup({ size = 22 }: { size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="FOMO">
      <FomoMark size={size} variant="white" />
      <Text style={{ fontSize: size * 1.05, lineHeight: size * 1.2, fontWeight: '800', letterSpacing: -size * 0.04 }}>fomo</Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 6 } });
