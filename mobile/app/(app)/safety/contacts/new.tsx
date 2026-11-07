import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { contactsApi } from '@/api/safety';
import { AppText, Button, Header, Screen, TextField } from '@/components';
import { colors, spacing } from '@/theme';

export default function NewContactScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      contactsApi.create({
        name: name.trim(),
        phone_number: phone.trim(),
        relationship: relationship.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['safety', 'contacts'] });
      router.back();
    },
    onError: (e) => setError(toApiError(e).message),
  });

  const canSubmit = name.trim().length > 0 && phone.trim().length >= 6;

  return (
    <Screen scroll>
      <Header title="Add contact" />
      <View style={styles.form}>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Mom" />
        <TextField
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+91…"
        />
        <TextField
          label="Relationship (optional)"
          value={relationship}
          onChangeText={setRelationship}
          placeholder="e.g. Parent, Friend"
        />

        {error ? (
          <AppText variant="caption" color={colors.danger}>
            {error}
          </AppText>
        ) : null}

        <Button
          label="Save contact"
          loading={create.isPending}
          disabled={!canSubmit}
          onPress={() => {
            setError(null);
            create.mutate();
          }}
          style={styles.submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  submit: { marginTop: spacing.sm },
});
