import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppModeStore, type AppMode } from '@/store/appModeStore';
import { colors, radius, shadow, spacing } from '@/theme';
import { AppText } from './AppText';

const OPTIONS: { value: AppMode; label: string; description: string }[] = [
  { value: 'rider', label: 'Rider', description: 'Find and book rides' },
  { value: 'driver', label: 'Driver', description: 'Offer and manage rides' },
];

/**
 * The "Rider ▾" pill on Home. Tapping it opens a bottom sheet to switch
 * between Rider/Driver — purely a UI preference (never sent to the backend,
 * never used for authorization). Switching is instant: no logout, no
 * re-authentication, no account selection.
 */
export function ModeSwitcher() {
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const current = OPTIONS.find((o) => o.value === mode) ?? OPTIONS[0];

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.pill}>
        <AppText variant="bodyStrong" color={colors.primary}>
          {current.label}
        </AppText>
        <ChevronDown size={16} color={colors.primary} strokeWidth={2.4} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText variant="heading" style={styles.title}>
            Switch mode
          </AppText>
          {OPTIONS.map((option) => {
            const selected = option.value === mode;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setMode(option.value);
                  setOpen(false);
                }}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <View style={styles.optionText}>
                  <AppText variant="bodyStrong">{option.label}</AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {option.description}
                  </AppText>
                </View>
                {selected ? <Check size={20} color={colors.primary} strokeWidth={2.6} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    ...shadow.card,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: { marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  optionSelected: { backgroundColor: colors.primaryTint, borderTopColor: 'transparent' },
  optionText: { gap: 2 },
});
