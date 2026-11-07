import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { AppText, Button, Screen, TextField } from '@/components';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const authenticate = useAuthStore((s) => s.authenticate);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const tokens = await authApi.verify(email, code.trim());
      await authenticate(tokens);
    },
    onError: (err) => setError(toApiError(err).message),
  });

  const resendMutation = useMutation({
    mutationFn: () => authApi.resend(email),
    onSuccess: () => setResent(true),
    onError: (err) => setError(toApiError(err).message),
  });

  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="display">Verify email</AppText>
        <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
          Enter the code we sent to{' '}
          <AppText variant="bodyStrong">{email || 'your college email'}</AppText>.
        </AppText>
      </View>

      <View style={styles.form}>
        <TextField
          label="Verification code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder="6-digit code"
          maxLength={8}
        />
        {error ? (
          <AppText variant="caption" color={colors.danger}>
            {error}
          </AppText>
        ) : null}
        <Button
          label="Verify"
          onPress={() => {
            setError(null);
            verifyMutation.mutate();
          }}
          loading={verifyMutation.isPending}
          disabled={code.trim().length < 4}
          style={styles.submit}
        />

        <Pressable
          onPress={() => {
            setError(null);
            resendMutation.mutate();
          }}
          disabled={resendMutation.isPending}
          style={styles.resend}
        >
          <AppText variant="body" color={colors.primary}>
            {resent ? 'Code sent again' : 'Resend code'}
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxxl, marginBottom: spacing.xxl },
  subtitle: { marginTop: spacing.sm },
  form: { gap: spacing.lg },
  submit: { marginTop: spacing.sm },
  resend: { alignSelf: 'center', padding: spacing.sm },
});
