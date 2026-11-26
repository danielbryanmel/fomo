import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { familyFor, Text } from '@/components/ui/Text';
import { colors, motion, spacing } from '@/theme';

type Props = TextInputProps & { label: string; hint?: string; error?: string | null; max?: number };

/** Campo (GUIA): 54px, rótulo acima, contador à direita, borda magenta no foco. */
export function Field({ label, hint, error, max, value, multiline, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const f = useDerivedValue(() => withTiming(focused ? 1 : 0, { duration: motion.base }), [focused]);
  const border = useAnimatedStyle(() => ({
    borderColor: error ? colors.danger : interpolateColor(f.value, [0, 1], [colors.border, colors.accent]),
  }));
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Text variant="label" tone="secondary" style={{ fontSize: 14, fontWeight: '700' }}>{label}</Text>
        {max ? <Text variant="caption" tone={(value?.length ?? 0) > max * 0.9 ? 'accent' : 'muted'}>{value?.length ?? 0}/{max}</Text> : null}
      </View>
      <Animated.View style={[styles.box, multiline && styles.multi, border]}>
        <TextInput
          {...rest}
          value={value}
          multiline={multiline}
          maxLength={max}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={[styles.input, multiline && styles.inputMulti, style]}
        />
      </Animated.View>
      {error ? <Text variant="caption" tone="danger" accessibilityRole="alert">{error}</Text> : hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  box: { borderRadius: 14, borderWidth: 1.5, backgroundColor: colors.surface, minHeight: 54, justifyContent: 'center' },
  multi: { minHeight: 96 },
  input: { color: colors.text, fontSize: 16, fontFamily: familyFor('400'), paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
});
