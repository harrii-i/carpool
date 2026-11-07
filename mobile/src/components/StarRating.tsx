import { Star } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
};

/** A 1–5 star picker (or read-only display). */
export function StarRating({ value, onChange, size = 28, readOnly = false }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={styles.row}>
      {stars.map((n) => {
        const filled = n <= value;
        const star = (
          <Star
            size={size}
            color={filled ? colors.star : colors.border}
            fill={filled ? colors.star : 'transparent'}
            strokeWidth={filled ? 0 : 2}
          />
        );
        if (readOnly) return <View key={n}>{star}</View>;
        return (
          <Pressable key={n} onPress={() => onChange?.(n)} hitSlop={6}>
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
});
