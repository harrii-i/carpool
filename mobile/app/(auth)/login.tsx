import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { AppText, Button, Screen, TextField } from '@/components';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const authenticate = useAuthStore((s) => s.authenticate);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const tokens = await authApi.login(email.trim(), password);
      await authenticate(tokens);
    },
    onError: (err) => {
      const apiError = toApiError(err);
      if (apiError.code === 'not_verified') {
        router.push({ pathname: '/(auth)/verify', params: { email: email.trim() } });
        return;
      }
      setError(apiError.message);
    },
  });

  const canSubmit = email.trim().length > 3 && password.length >= 1;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="display">Welcome back</AppText>
        <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
          Sign in with your college email to find and share rides.
        </AppText>
      </View>

      <View style={styles.form}>
        <TextField
          label="College email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@college.edu"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Your password"
        />
        {error ? (
          <AppText variant="caption" color={colors.danger}>
            {error}
          </AppText>
        ) : null}
        <Button
          label="Sign in"
          onPress={() => {
            setError(null);
            mutation.mutate();
          }}
          loading={mutation.isPending}
          disabled={!canSubmit}
          style={styles.submit}
        />
      </View>

      <View style={styles.footer}>
        <AppText variant="body" color={colors.textSecondary}>
          New here?{' '}
        </AppText>
        <Link href="/(auth)/register">
          <AppText variant="bodyStrong" color={colors.primary}>
            Create an account
          </AppText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxxl, marginBottom: spacing.xxl },
  subtitle: { marginTop: spacing.sm },
  form: { gap: spacing.lg },
  submit: { marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
});
