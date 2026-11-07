import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Bike, Car, Plus } from 'lucide-react-native';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { vehiclesApi } from '@/api/vehicles';
import type { Vehicle } from '@/api/types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  LoadingState,
  Screen,
} from '@/components';
import { colors, radius, spacing } from '@/theme';

export default function VehiclesScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['vehicles'], queryFn: vehiclesApi.list });

  const toggle = useMutation({
    mutationFn: (v: Vehicle) => (v.is_active ? vehiclesApi.deactivate(v.id) : vehiclesApi.activate(v.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
    onError: (e) => Alert.alert('Error', toApiError(e).message),
  });

  return (
    <Screen padded={false}>
      <View style={styles.headerWrap}>
        <Header title="My vehicles" />
      </View>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={toApiError(query.error).message} onRetry={query.refetch} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Car size={40} color={colors.primary} strokeWidth={2} />}
          title="No vehicles yet"
          message="Add a bike or car to start offering rides."
          action={<Button label="Add vehicle" fullWidth={false} onPress={() => router.push('/vehicles/new')} />}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {query.data!.map((v) => (
            <Card key={v.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconTile}>
                  {v.vehicle_type === 'BIKE' ? (
                    <Bike size={22} color={colors.primary} strokeWidth={2.2} />
                  ) : (
                    <Car size={22} color={colors.primary} strokeWidth={2.2} />
                  )}
                </View>
                <View style={styles.info}>
                  <AppText variant="cardTitle">
                    {v.brand} {v.model}
                  </AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {v.registration_number} · {v.color} · {v.seat_capacity} seats
                  </AppText>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <AppText variant="caption" color={v.is_active ? colors.success : colors.textSecondary}>
                  {v.is_active ? 'Active' : 'Inactive'}
                </AppText>
                <Button
                  label={v.is_active ? 'Deactivate' : 'Activate'}
                  variant="secondary"
                  size="md"
                  fullWidth={false}
                  loading={toggle.isPending && toggle.variables?.id === v.id}
                  onPress={() => toggle.mutate(v)}
                />
              </View>
            </Card>
          ))}
          <Button
            label="Add vehicle"
            icon={<Plus size={18} color={colors.white} strokeWidth={2.4} />}
            onPress={() => router.push('/vehicles/new')}
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
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  add: { marginTop: spacing.sm },
});
