import { colors } from '@/theme';
import type { RideStatus } from '@/api/types';

/** Shared status → {dot color, label} mapping, used anywhere a ride's status
 * needs a compact colored-dot + text treatment (chat list, chat thread, …). */
export const RIDE_STATUS_META: Record<RideStatus, { dot: string; label: string }> = {
  OPEN: { dot: colors.textSecondary, label: 'Upcoming ride' },
  FULL: { dot: colors.textSecondary, label: 'Upcoming ride' },
  STARTED: { dot: colors.success, label: 'Ride in progress' },
  COMPLETED: { dot: colors.border, label: 'Ride completed' },
  CANCELLED: { dot: colors.danger, label: 'Ride cancelled' },
};
