import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';
import { Text } from './Text';

type Props = { name: string; url?: string | null; size?: number; seed?: string };

const TINTS = ['#3A2340', '#2A2346', '#3D2233', '#22303F', '#33283F'];

/** Avatar com fallback de iniciais (sem imagens externas no mock). */
export function Avatar({ name, url, size = 40, seed = name }: Props) {
  // só letras/números: "Lia (demo)" → "L"; ignora parênteses, emoji e pontuação
  const initials =
    name
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((w) => w && w.toLowerCase() !== 'demo')
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '·';
  const tint = TINTS[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
  const style = { width: size, height: size, borderRadius: radius.pill };

  if (url) {
    return <Image source={{ uri: url }} style={style} contentFit="cover" transition={150} accessibilityLabel={`Foto de ${name}`} />;
  }
  return (
    <View style={[styles.fallback, style, { backgroundColor: tint }]} accessibilityLabel={`Avatar de ${name}`}>
      <Text variant={size >= 64 ? 'title' : 'label'} style={{ fontSize: size * 0.38, lineHeight: size * 0.46 }}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
});
