import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme';

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

/** White, rounded, softly-shadowed surface — the base for most content. */
export function Card({ children, onPress, style, padded = true }: CardProps) {
  const content = (
    <View style={[styles.card, padded && styles.padded, style]}>{children}</View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    ...shadow.card,
  },
  padded: { padding: spacing.lg },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
});
