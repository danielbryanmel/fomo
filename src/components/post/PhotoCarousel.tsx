import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { FomoBurst } from '@/components/icons/FomoIcons';
import { Text } from '@/components/ui/Text';
import { displayRatio } from '@/features/compose/photos';
import { colors, radius, spacing } from '@/theme';
import type { PostPhoto } from '@/types/domain';

type Props = {
  photos: PostPhoto[];
  /** Toque duplo curte (como no Instagram). */
  onDoubleTap?: () => void;
  onPress?: () => void;
  rounded?: number;
  accessibilityLabel?: string;
};

/** Carrossel paginado de fotos com indicador e coração no toque duplo. */
export function PhotoCarousel({ photos, onDoubleTap, onPress, rounded = 0, accessibilityLabel }: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heart = useSharedValue(0);

  const heartStyle = useAnimatedStyle(() => ({ opacity: heart.value, transform: [{ scale: 0.5 + heart.value * 0.6 }, { rotate: `${(1 - heart.value) * -25}deg` }] }));

  const first = photos[0];
  if (!first) return null;
  const ratio = displayRatio(first.width, first.height);

  function handlePress() {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      clearTimeout(single.current);
      lastTap.current = 0;
      heart.value = withSequence(withSpring(1, { damping: 12 }), withTiming(0, { duration: 500 }));
      onDoubleTap?.();
    } else {
      lastTap.current = now;
      single.current = setTimeout(() => onPress?.(), 290);
    }
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  }

  return (
    <View
      style={[styles.wrap, { aspectRatio: ratio, borderRadius: rounded }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={accessibilityLabel ?? `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`}
    >
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}>
        {photos.map((p, i) => (
          <Pressable key={i} onPress={handlePress} style={{ width, height: '100%' }} accessibilityRole="image" accessibilityLabel={`Foto ${i + 1} de ${photos.length}`} accessibilityHint="Toque duas vezes para curtir">
            <Image source={p.source} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={typeof p.source === 'number' ? String(p.source) : p.source.uri} />
          </Pressable>
        ))}
      </ScrollView>

      <Animated.View pointerEvents="none" style={[styles.heart, heartStyle]}>
        <FomoBurst size={104} />
      </Animated.View>

      {photos.length > 1 ? (
        <>
          <View style={styles.counter} pointerEvents="none">
            <Text variant="mono" style={{ fontSize: 10 }}>{index + 1}/{photos.length}</Text>
          </View>
          <View style={styles.dots} pointerEvents="none">
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  heart: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', top: spacing.md, right: spacing.md, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(10,10,11,0.7)' },
  dots: { position: 'absolute', bottom: spacing.md, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { backgroundColor: colors.text, width: 7, height: 7 },
});
