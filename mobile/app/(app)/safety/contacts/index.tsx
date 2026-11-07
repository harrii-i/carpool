import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Plus, Star, Trash, Users } from 'lucide-react-native';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { contactsApi } from '@/api/safety';
import { toApiError } from '@/api/client';
import type { EmergencyContact } from '@/api/types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  LoadingState,
  Screen,
} from '@/components';
import { colors, spacing } from '@/theme';

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['safety', 'contacts'], queryFn: contactsApi.list });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['safety', 'contacts'] });

  const setPrimary = useMutation({
    mutationFn: (id: string) => contactsApi.setPrimary(id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Error', toApiError(e).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => contactsApi.remove(id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Error', toApiError(e).message),
  });

  const confirmRemove = (contact: EmergencyContact) => {
    Alert.alert('Remove contact?', `Remove ${contact.name} from your emergency contacts.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(contact.id) },
    ]);
  };

  return (
    <Screen padded={false}>
      <View style={styles.headerWrap}>
        <Header title="Emergency contacts" />
      </View>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={toApiError(query.error).message} onRetry={query.refetch} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Users size={40} color={colors.primary} strokeWidth={2} />}
          title="No contacts yet"
          message="Add someone who should be notified if you trigger SOS."
          action={
            <Button label="Add contact" fullWidth={false} onPress={() => router.push('/safety/contacts/new')} />
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {query.data!.map((c) => (
            <Card key={c.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <AppText variant="cardTitle">{c.name}</AppText>
                    {c.is_primary ? (
                      <View style={styles.primaryBadge}>
                        <Star size={12} color={colors.star} strokeWidth={2.6} fill={colors.star} />
                        <AppText variant="secondary" color={colors.star}>
                          Primary
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {c.phone_number}
                    {c.relationship ? ` · ${c.relationship}` : ''}
                  </AppText>
                </View>
                <IconButton size={40} onPress={() => confirmRemove(c)}>
                  <Trash size={18} color={colors.danger} strokeWidth={2.2} />
                </IconButton>
              </View>
              {!c.is_primary ? (
                <Button
                  label="Set as primary"
                  variant="secondary"
                  size="md"
                  fullWidth={false}
                  loading={setPrimary.isPending && setPrimary.variables === c.id}
                  onPress={() => setPrimary.mutate(c.id)}
                  style={styles.setPrimaryBtn}
                />
              ) : null}
            </Card>
          ))}
          <Button
            label="Add contact"
            icon={<Plus size={18} color={colors.white} strokeWidth={2.4} />}
            onPress={() => router.push('/safety/contacts/new')}
            style={styles.add}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.gutter },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: 120, gap: spacing.md },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  setPrimaryBtn: { alignSelf: 'flex-start' },
  add: { marginTop: spacing.sm },
});
