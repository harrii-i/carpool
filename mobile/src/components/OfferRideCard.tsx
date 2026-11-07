import { ChevronRight, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

type OfferRideCardProps = {
  onPress: () => void;
};

/**
 * Driver-mode's primary hero card — the same visual tier as the Rider-mode
 * search card (a floating white card over the gradient hero), so switching
 * modes swaps which capability is visually primary without inventing a new
 * design language for it.
 */
export function OfferRideCard({ onPress }: OfferRideCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconTile}>
          <Plus size={24} color={colors.white} strokeWidth={2.6} />
        </View>
        <View style={styles.text}>
          <AppText variant="cardTitle">Offer a ride</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            Share your empty seats and help fellow students get where they're
            going.
          </AppText>
        </View>
      </View>

      <Button
        label="Post a ride"
        icon={<Plus size={18} color={colors.white} strokeWidth={2.6} />}
        trailingIcon={<ChevronRight size={20} color={colors.white} strokeWidth={2.4} />}
        onPress={onPress}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg, marginBottom: -spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent.mint.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
