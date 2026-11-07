import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { AppText, Button, Screen, TextField } from '@/components';
import { colors, spacing } from '@/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const [admission, setAdmission] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      authApi.register({
        admission_number: admission.trim(),
        college_email: email.trim(),
        phone_number: phone.trim(),
        password,
      }),
    onSuccess: () => {
      router.push({ pathname: '/(auth)/verify', params: { email: email.trim() } });
    },
    onError: (err) => setError(toApiError(err).message),
  });

  const canSubmit =
    admission.trim().length > 0 &&
    email.trim().length > 3 &&
    phone.trim().length >= 6 &&
    password.length >= 8;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="display">Create account</AppText>
        <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
          We verify your details against the college registry. Name, department
          and year are filled in automatically.
        </AppText>
      </View>

      <View style={styles.form}>
        <TextField
          label="Admission number"
          value={admission}
          onChangeText={setAdmission}
          autoCapitalize="characters"
          placeholder="e.g. ADM1001"
        />
        <TextField
          label="College email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@college.edu"
        />
        <TextField
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+91…"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
        />
        {error ? (
          <AppText variant="caption" color={colors.danger}>
            {error}
          </AppText>
        ) : null}
        <Button
          label="Create account"
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
          Already have an account?{' '}
        </AppText>
        <Link href="/(auth)/login">
          <AppText variant="bodyStrong" color={colors.primary}>
            Sign in
          </AppText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  subtitle: { marginTop: spacing.sm },
  form: { gap: spacing.lg },
  submit: { marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
});
