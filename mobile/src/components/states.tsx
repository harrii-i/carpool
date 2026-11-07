import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';

/** Loading / empty / error states shared across screens (§42). */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      <AppText variant="caption" color={colors.textSecondary} style={styles.gap}>
        {label}
      </AppText>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      {icon}
      <AppText variant="heading" center style={styles.gap}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color={colors.textSecondary} center style={styles.msg}>
          {message}
        </AppText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <AppText variant="heading" center>
        Couldn’t load this
      </AppText>
      <AppText variant="body" color={colors.textSecondary} center style={styles.msg}>
        {message}
      </AppText>
      {onRetry ? (
        <View style={styles.action}>
          <Button label="Try again" variant="secondary" fullWidth={false} onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  gap: { marginTop: spacing.md },
  msg: { marginTop: spacing.sm, maxWidth: 300 },
  action: { marginTop: spacing.xl },
});
