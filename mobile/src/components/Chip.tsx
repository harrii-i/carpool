import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'dark' | 'primary';
};

/** Pill chip: active = solid (ink or primary), inactive = light grey. */
export function Chip({ label, active = false, onPress, tone = 'dark' }: ChipProps) {
  const activeBg = tone === 'primary' ? colors.primary : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? activeBg : colors.chipBg },
        pressed && { opacity: 0.85 },
      ]}
    >
      <AppText
        variant="caption"
        color={active ? colors.white : colors.textSecondary}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
});
