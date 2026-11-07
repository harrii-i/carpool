import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

type RouteLineProps = {
  origin: string;
  destination: string;
};

/** Vertical origin→destination list with filled/outline dots and a connector. */
export function RouteLine({ origin, destination }: RouteLineProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.markers}>
        <View style={styles.dotFilled} />
        <View style={styles.connector} />
        <View style={styles.dotOutline} />
      </View>
      <View style={styles.labels}>
        <View style={styles.labelBlock}>
          <AppText variant="secondary" color={colors.textSecondary}>
            Pickup
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {origin}
          </AppText>
        </View>
        <View style={styles.labelBlock}>
          <AppText variant="secondary" color={colors.textSecondary}>
            Destination
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {destination}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const DOT = 12;

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: spacing.md },
  markers: { alignItems: 'center', paddingTop: 20 },
  dotFilled: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.primary,
  },
  dotOutline: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  connector: { width: 2, flex: 1, minHeight: 28, backgroundColor: colors.border },
  labels: { flex: 1, gap: spacing.lg },
  labelBlock: { gap: 2 },
});
