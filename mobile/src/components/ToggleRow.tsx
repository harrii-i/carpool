import { StyleSheet, Switch, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

type ToggleRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  last?: boolean;
};

export function ToggleRow({ label, description, value, onValueChange, last }: ToggleRowProps) {
  return (
    <View style={[styles.row, !last && styles.border]}>
      <View style={styles.text}>
        <AppText variant="body">{label}</AppText>
        {description ? (
          <AppText variant="caption" color={colors.textSecondary} style={styles.description}>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.chipBg, true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  text: { flex: 1, gap: 2 },
  description: { marginTop: 1 },
});
