import { ChevronRight, Clock, MapPin, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RideListItem } from '@/api/types';
import { formatDeparture } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { StatusBadge } from './Badge';

type ActivityRideCardProps = {
  ride: RideListItem;
  /** Only meaningful for role==='passenger' rows — the booking's own status,
   * since a rider cares whether *their seat* is confirmed, not whether the
   * ride still has open seats for others. Omitted when unknown. */
  bookingStatus?: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  onPress: () => void;
};

/** A richer "Upcoming activity" row for Home: who's driving + the route at a
 * glance, distinct from the compact RideCard used in search/history lists. */
export function ActivityRideCard({ ride, bookingStatus, onPress }: ActivityRideCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Avatar name={ride.driver.name} uri={ride.driver.profile_image} shape="circle" size={44} />
        <View style={styles.headerText}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {ride.driver.name}
          </AppText>
          <AppText variant="secondary" color={colors.textSecondary} numberOfLines={1}>
            {ride.vehicle.brand} {ride.vehicle.model}
          </AppText>
        </View>
        {ride.role === 'driver' ? (
          <StatusBadge status={ride.status} />
        ) : bookingStatus ? (
          <View style={styles.confirmedBadge}>
            <AppText variant="secondary" color={colors.primary}>
              {bookingStatus === 'CONFIRMED'
                ? 'Confirmed'
                : bookingStatus === 'COMPLETED'
                  ? 'Completed'
                  : 'Cancelled'}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.routeDots}>
          <View style={styles.dotFilled} />
          <View style={styles.dotConnector} />
          <MapPin size={14} color={colors.success} strokeWidth={2.4} fill={colors.success} />
        </View>
        <View style={styles.routeLabels}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {ride.origin}
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {ride.destination}
          </AppText>
        </View>
        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <Clock size={14} color={colors.textSecondary} strokeWidth={2.2} />
            <AppText variant="secondary" color={colors.textSecondary}>
              {formatDeparture(ride.departure_time)}
            </AppText>
          </View>
          <View style={styles.metaRow}>
            <Users size={14} color={colors.textSecondary} strokeWidth={2.2} />
            <AppText variant="secondary" color={colors.textSecondary}>
              {ride.available_seats} seats left
            </AppText>
          </View>
        </View>
        <View style={styles.chevronBtn}>
          <ChevronRight size={18} color={colors.ink} strokeWidth={2.2} />
        </View>
      </View>
    </Pressable>
  );
}

const DOT = 10;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 1 },
  confirmedBadge: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  body: { flexDirection: 'row', alignItems: 'center' },
  routeDots: { alignItems: 'center', width: 20, gap: 2 },
  dotFilled: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.primary },
  dotConnector: { width: 2, height: 24, backgroundColor: colors.border },
  routeLabels: { flex: 1, gap: spacing.md, marginLeft: spacing.sm },
  meta: { gap: spacing.xs, marginLeft: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chevronBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
});
