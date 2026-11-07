import { ArrowRight, Clock, Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { RideListItem } from '@/api/types';
import { colors, spacing } from '@/theme';
import { formatContribution, formatDeparture, formatDistance } from '@/lib/format';
import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { StatusBadge } from './Badge';

type RideCardProps = {
  ride: RideListItem;
  onPress?: () => void;
  showStatus?: boolean;
};

export function RideCard({ ride, onPress, showStatus = false }: RideCardProps) {
  const distance = formatDistance(ride.distance_m);

  return (
    <Card onPress={onPress} style={styles.card}>
      {/* Route */}
      <View style={styles.routeRow}>
        <AppText variant="cardTitle" numberOfLines={1} style={styles.place}>
          {ride.origin}
        </AppText>
        <ArrowRight size={16} color={colors.textSecondary} strokeWidth={2.4} />
        <AppText variant="cardTitle" numberOfLines={1} style={styles.place}>
          {ride.destination}
        </AppText>
      </View>

      {/* Meta */}
      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Clock size={14} color={colors.textSecondary} strokeWidth={2.2} />
          <AppText variant="caption" color={colors.textSecondary}>
            {formatDeparture(ride.departure_time)}
          </AppText>
        </View>
        <View style={styles.meta}>
          <Users size={14} color={colors.textSecondary} strokeWidth={2.2} />
          <AppText variant="caption" color={colors.textSecondary}>
            {ride.available_seats} left
          </AppText>
        </View>
        {distance ? (
          <AppText variant="caption" color={colors.textSecondary}>
            {distance}
          </AppText>
        ) : null}
      </View>

      <View style={styles.divider} />

      {/* Driver + price */}
      <View style={styles.footer}>
        <View style={styles.driver}>
          <Avatar name={ride.driver.name} uri={ride.driver.profile_image} size={36} />
          <View>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {ride.driver.name}
            </AppText>
            <AppText variant="secondary" color={colors.textSecondary}>
              {ride.vehicle.brand} {ride.vehicle.model}
            </AppText>
          </View>
        </View>
        {showStatus ? (
          <StatusBadge status={ride.status} />
        ) : (
          <AppText variant="cardTitle" color={colors.primary}>
            {formatContribution(ride.contribution_amount)}
          </AppText>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  place: { flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  driver: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
});
