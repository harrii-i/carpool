import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function Stepper({ value, onChange, min = 1, max = 8 }: StepperProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <View style={styles.row}>
      <StepButton disabled={value <= min} onPress={dec}>
        <Minus size={18} color={value <= min ? colors.textSecondary : colors.ink} strokeWidth={2.6} />
      </StepButton>
      <AppText variant="cardTitle" style={styles.value}>
        {value}
      </AppText>
      <StepButton disabled={value >= max} onPress={inc}>
        <Plus size={18} color={value >= max ? colors.textSecondary : colors.ink} strokeWidth={2.6} />
      </StepButton>
    </View>
  );
}

function StepButton({
  children,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.button}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: 24, textAlign: 'center' },
});
