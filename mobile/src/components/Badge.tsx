import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import type { RideStatus } from '@/api/types';

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  OPEN: { bg: '#E6F7EF', fg: colors.success, label: 'Open' },
  FULL: { bg: colors.primaryTint, fg: colors.primary, label: 'Full' },
  STARTED: { bg: '#FFF3D6', fg: '#B8860B', label: 'On the way' },
  COMPLETED: { bg: colors.chipBg, fg: colors.textSecondary, label: 'Completed' },
  CANCELLED: { bg: '#FDE7EA', fg: colors.danger, label: 'Cancelled' },
};

export function StatusBadge({ status }: { status: RideStatus }) {
  const meta = STATUS_COLORS[status] ?? STATUS_COLORS.OPEN;
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <AppText variant="secondary" color={meta.fg}>
        {meta.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
