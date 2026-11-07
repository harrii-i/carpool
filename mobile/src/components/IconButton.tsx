import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { colors, radius, shadow } from '@/theme';

type IconButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  size?: number;
  variant?: 'surface' | 'tint';
  style?: StyleProp<ViewStyle>;
};

/** White (or tinted) rounded-square icon button, as in the header/nav. */
export function IconButton({
  children,
  onPress,
  size = 48,
  variant = 'surface',
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          backgroundColor: variant === 'tint' ? colors.primaryTint : colors.surface,
        },
        variant === 'surface' && shadow.subtle,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
