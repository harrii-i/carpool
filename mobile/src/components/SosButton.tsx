import { ShieldAlert } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';

import { useSosTrigger } from '@/lib/useSosTrigger';
import { colors, radius } from '@/theme';

type SosButtonProps = {
  rideId?: string;
  size?: number;
};

/**
 * Prominent, hard-to-miss SOS trigger (§28). A confirm step avoids accidental
 * fires while keeping the action one tap away, per §28's "avoid accidental
 * triggers where practical, but emergency actions must remain easily
 * accessible."
 */
export function SosButton({ rideId, size = 48 }: SosButtonProps) {
  const { trigger, triggering } = useSosTrigger();

  const confirm = () => {
    Alert.alert(
      'Trigger SOS?',
      'This alerts your emergency contacts and may share your live location.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Trigger SOS', style: 'destructive', onPress: () => trigger(rideId) },
      ],
    );
  };

  return (
    <Pressable
      onPress={confirm}
      disabled={triggering}
      style={[styles.button, { width: size, height: size, borderRadius: radius.md }]}
      hitSlop={8}
    >
      {triggering ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <ShieldAlert size={size * 0.46} color={colors.white} strokeWidth={2.4} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
