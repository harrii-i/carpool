import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  /** An icon pinned to the far right, with icon+label centered — e.g. a
   * chevron on a "Find a ride"-style call-to-action. */
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<Size, number> = { md: 48, lg: 56 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  icon,
  trailingIcon,
  fullWidth = true,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHT[size] },
        fullWidth && styles.fullWidth,
        variantStyle(variant, pressed),
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.ink : colors.white} />
      ) : trailingIcon ? (
        <View style={styles.spreadContent}>
          <View style={styles.spreadSpacer} />
          <View style={styles.spreadCenter}>
            {icon}
            <AppText style={[typography.bodyStrong, { color: labelColor(variant) }]}>
              {label}
            </AppText>
          </View>
          <View style={styles.spreadTrailing}>{trailingIcon}</View>
        </View>
      ) : (
        <View style={styles.content}>
          {icon}
          <AppText
            style={[typography.bodyStrong, { color: labelColor(variant) }]}
          >
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

function variantStyle(variant: Variant, pressed: boolean): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: pressed ? colors.primaryPressed : colors.primary };
    case 'danger':
      return { backgroundColor: pressed ? '#D63A4C' : colors.danger };
    case 'secondary':
      return {
        backgroundColor: pressed ? colors.chipBg : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      };
    case 'ghost':
      return { backgroundColor: pressed ? colors.chipBg : 'transparent' };
  }
}

function labelColor(variant: Variant): string {
  return variant === 'secondary' || variant === 'ghost' ? colors.ink : colors.white;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // A 3-column layout for a centered icon+label with a trailing icon pinned
  // to the edge: a same-sized invisible spacer balances the trailing icon so
  // the group visually centers rather than hugging the left edge.
  spreadContent: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  spreadSpacer: { width: 24 },
  spreadCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  spreadTrailing: { width: 24, alignItems: 'flex-end' },
});
