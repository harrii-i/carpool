import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { sosConfigApi } from '@/api/safety';
import {
  AppText,
  Button,
  Card,
  ErrorState,
  Header,
  LoadingState,
  Screen,
  TextField,
  ToggleRow,
} from '@/components';
import { colors, spacing } from '@/theme';

export default function SosSettingsScreen() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['safety', 'config'], queryFn: sosConfigApi.get });

  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (query.data && !dirty) setMessage(query.data.custom_message);
  }, [query.data, dirty]);

  const update = useMutation({
    mutationFn: sosConfigApi.update,
    onSuccess: (data) => {
      qc.setQueryData(['safety', 'config'], data);
    },
    onError: (e) => Alert.alert('Could not update', toApiError(e).message),
  });

  const saveMessage = useMutation({
    mutationFn: () => sosConfigApi.update({ custom_message: message }),
    onSuccess: (data) => {
      qc.setQueryData(['safety', 'config'], data);
      setDirty(false);
    },
    onError: (e) => Alert.alert('Could not save message', toApiError(e).message),
  });

  if (query.isLoading) {
    return (
      <Screen>
        <Header title="SOS settings" />
        <LoadingState label="Loading SOS settings…" />
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen>
        <Header title="SOS settings" />
        <ErrorState
          message={query.error ? toApiError(query.error).message : undefined}
          onRetry={query.refetch}
        />
      </Screen>
    );
  }

  const config = query.data;
  const toggle = (field: keyof typeof config) => (value: boolean) =>
    update.mutate({ [field]: value });

  return (
    <Screen scroll>
      <Header title="SOS settings" />
      <AppText variant="body" color={colors.textSecondary} style={styles.intro}>
        Choose what happens when you trigger SOS. These actions run on your
        device — nothing is sent without your confirmation.
      </AppText>

      <Card padded={false} style={styles.card}>
        <View style={styles.padded}>
          <ToggleRow
            label="Call primary contact"
            description="Open the dialer with your primary contact"
            value={config.call_primary_contact}
            onValueChange={toggle('call_primary_contact')}
          />
          <ToggleRow
            label="Send emergency message"
            description="Compose an SMS with your situation and location"
            value={config.send_emergency_message}
            onValueChange={toggle('send_emergency_message')}
          />
          <ToggleRow
            label="Share live location"
            description="Start a live tracking link automatically"
            value={config.share_live_location}
            onValueChange={toggle('share_live_location')}
          />
          <ToggleRow
            label="Notify selected contacts"
            description="Send the message to all active contacts, not just primary"
            value={config.notify_selected_contacts}
            onValueChange={toggle('notify_selected_contacts')}
          />
          <ToggleRow
            label="Notify college security"
            value={config.notify_college_security}
            onValueChange={toggle('notify_college_security')}
            last
          />
        </View>
      </Card>

      <View style={styles.messageSection}>
        <AppText variant="caption" color={colors.textSecondary}>
          Emergency message
        </AppText>
        <TextField
          value={message}
          onChangeText={(t) => {
            setMessage(t);
            setDirty(true);
          }}
          multiline
          numberOfLines={4}
          style={styles.messageInput}
        />
        <AppText variant="secondary" color={colors.textSecondary}>
          Variables: {'{name} {ride} {driver} {vehicle} {location_link}'}
        </AppText>
        {dirty ? (
          <Button
            label="Save message"
            size="md"
            fullWidth={false}
            loading={saveMessage.isPending}
            onPress={() => saveMessage.mutate()}
            style={styles.saveBtn}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  card: { marginBottom: spacing.xl },
  padded: { paddingHorizontal: spacing.lg },
  messageSection: { gap: spacing.sm },
  messageInput: { minHeight: 100, textAlignVertical: 'top', paddingTop: spacing.md },
  saveBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' },
});
