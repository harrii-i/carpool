import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { reportsApi } from '@/api/reports';
import type { ReportReason } from '@/api/types';
import { AppText, Button, Chip, Header, Screen, TextField } from '@/components';
import { colors, spacing } from '@/theme';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'UNSAFE_BEHAVIOR', label: 'Unsafe behavior' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'FAKE_PROFILE', label: 'Fake profile' },
  { value: 'VEHICLE_MISMATCH', label: 'Vehicle mismatch' },
  { value: 'INAPPROPRIATE_BEHAVIOR', label: 'Inappropriate behavior' },
  { value: 'OTHER', label: 'Other' },
];

export default function ReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rideId?: string; reportedUserId?: string; name?: string }>();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      reportsApi.create({
        reported_user: params.reportedUserId,
        ride: params.rideId,
        reason: reason!,
        description: description.trim(),
      }),
    onSuccess: () => {
      Alert.alert('Report submitted', 'Thank you — our team will review this.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e) => setError(toApiError(e).message),
  });

  return (
    <Screen scroll>
      <Header title="Report" />
      {params.name ? (
        <AppText variant="body" color={colors.textSecondary} style={styles.subject}>
          Reporting {params.name}
        </AppText>
      ) : null}

      <View style={styles.form}>
        <AppText variant="caption" color={colors.textSecondary}>
          Reason
        </AppText>
        <View style={styles.chips}>
          {REASONS.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              active={reason === r.value}
              tone="primary"
              onPress={() => setReason(r.value)}
            />
          ))}
        </View>

        <TextField
          label="Details (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What happened?"
          multiline
          numberOfLines={5}
          style={styles.description}
        />

        {error ? (
          <AppText variant="caption" color={colors.danger}>
            {error}
          </AppText>
        ) : null}

        <Button
          label="Submit report"
          variant="danger"
          loading={submit.isPending}
          disabled={!reason}
          onPress={() => {
            setError(null);
            submit.mutate();
          }}
          style={styles.submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subject: { marginTop: spacing.sm },
  form: { gap: spacing.md, marginTop: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  description: { minHeight: 110, textAlignVertical: 'top', paddingTop: spacing.md },
  submit: { marginTop: spacing.md },
});
