import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

type HeaderProps = {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
};

/** Screen header matching the reference: back button · centered title · action. */
export function Header({ title, right, onBack }: HeaderProps) {
  const router = useRouter();
  const back = onBack ?? (() => router.back());

  return (
    <View style={styles.row}>
      <IconButton onPress={back}>
        <ChevronLeft size={22} color={colors.ink} strokeWidth={2.4} />
      </IconButton>
      <AppText variant="title" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <View style={styles.right}>{right ?? <View style={styles.spacer} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  title: { flex: 1, textAlign: 'center' },
  right: { minWidth: 48, alignItems: 'flex-end' },
  spacer: { width: 48 },
});
