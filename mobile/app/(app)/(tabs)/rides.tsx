import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { ridesApi } from '@/api/rides';
import type { RideListItem, VehicleType } from '@/api/types';
import {
  AppText,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  RideCard,
  Screen,
  SegmentedControl,
} from '@/components';
import { colors, spacing } from '@/theme';

type Mode = 'available' | 'mine';
type TypeFilter = 'ALL' | VehicleType;
type RoleFilter = 'driver' | 'rider';

export default function RidesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'mine' ? 'mine' : 'available');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');

  // Home's "My rides" tile / "Recent trips" quick link deep-link here with
  // ?mode=mine; react to it even if this screen was already mounted.
  useEffect(() => {
    if (params.mode === 'mine') setMode('mine');
  }, [params.mode]);

  return (
    <Screen padded={false}>
      <View style={styles.headerArea}>
        <View style={styles.titleRow}>
          <AppText variant="title">Rides</AppText>
          <IconButton onPress={() => router.push('/ride/create')} variant="tint">
            <Plus size={20} color={colors.primary} strokeWidth={2.4} />
          </IconButton>
        </View>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: 'available', label: 'Available' },
            { value: 'mine', label: 'My rides' },
          ]}
        />
      </View>

      {mode === 'available' ? (
        <AvailableRides
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          onOpen={(id) => router.push(`/ride/${id}`)}
        />
      ) : (
        <MyRides onOpen={(id) => router.push(`/ride/${id}`)} />
      )}
    </Screen>
  );
}

function AvailableRides({
  typeFilter,
  onTypeFilter,
  onOpen,
}: {
  typeFilter: TypeFilter;
  onTypeFilter: (t: TypeFilter) => void;
  onOpen: (id: string) => void;
}) {
  const query = useQuery({
    queryKey: ['rides', 'search', typeFilter],
    queryFn: () =>
      ridesApi.search(
        typeFilter === 'ALL' ? {} : { vehicle_type: typeFilter },
      ),
  });

  return (
    <FlatList
      data={query.data ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }: { item: RideListItem }) => (
        <RideCard ride={item} onPress={() => onOpen(item.id)} />
      )}
      ListHeaderComponent={
        <View style={styles.filters}>
          {(['ALL', 'CAR', 'BIKE'] as TypeFilter[]).map((t) => (
            <Chip
              key={t}
              label={t === 'ALL' ? 'All' : t === 'CAR' ? 'Cars' : 'Bikes'}
              active={typeFilter === t}
              tone="primary"
              onPress={() => onTypeFilter(t)}
            />
          ))}
        </View>
      }
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        query.isLoading ? (
          <LoadingState label="Finding rides…" />
        ) : query.isError ? (
          <ErrorState message={toApiError(query.error).message} onRetry={query.refetch} />
        ) : (
          <EmptyState
            icon={<Search size={40} color={colors.primary} strokeWidth={2} />}
            title="No rides right now"
            message="Check back soon, or post your own ride for others to join."
          />
        )
      }
    />
  );
}

function MyRides({ onOpen }: { onOpen: (id: string) => void }) {
  const params = useLocalSearchParams<{ role?: string }>();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(
    params.role === 'rider' ? 'rider' : 'driver',
  );
  const query = useQuery({ queryKey: ['rides', 'history'], queryFn: ridesApi.history });

  // Home's mode-aware links deep-link here with a `role` hint (the current
  // app mode) — it only seeds the initial sub-tab; the user can still freely
  // switch between Driver/Rider history manually below.
  useEffect(() => {
    if (params.role === 'driver' || params.role === 'rider') setRoleFilter(params.role);
  }, [params.role]);

  if (query.isLoading) return <LoadingState label="Loading your rides…" />;
  if (query.isError) return <ErrorState message={toApiError(query.error).message} onRetry={query.refetch} />;

  const history = query.data!;
  const wantedRole = roleFilter === 'driver' ? 'driver' : 'passenger';
  const byRole = (data: RideListItem[]) => data.filter((r) => r.role === wantedRole);

  const sections: { title: string; data: RideListItem[] }[] = [
    { title: 'Active', data: byRole(history.active) },
    { title: 'Upcoming', data: byRole(history.upcoming) },
    { title: 'Completed', data: byRole(history.completed) },
    { title: 'Cancelled', data: byRole(history.cancelled) },
  ].filter((s) => s.data.length > 0);

  const roleSwitcher = (
    <SegmentedControl
      value={roleFilter}
      onChange={setRoleFilter}
      options={[
        { value: 'driver', label: 'Driver' },
        { value: 'rider', label: 'Rider' },
      ]}
    />
  );

  if (sections.length === 0) {
    return (
      <View style={styles.list}>
        <View style={styles.roleSwitcher}>{roleSwitcher}</View>
        <EmptyState
          title={roleFilter === 'driver' ? 'No rides posted yet' : 'No rides joined yet'}
          message={
            roleFilter === 'driver'
              ? 'Rides you post as a driver will appear here.'
              : 'Rides you join as a passenger will appear here.'
          }
        />
      </View>
    );
  }

  return (
    <FlatList
      data={sections}
      keyExtractor={(s) => s.title}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.primary} />
      }
      ListHeaderComponent={<View style={styles.roleSwitcher}>{roleSwitcher}</View>}
      renderItem={({ item: section }) => (
        <View style={styles.section}>
          <AppText variant="caption" color={colors.textSecondary} style={styles.sectionTitle}>
            {section.title.toUpperCase()}
          </AppText>
          {section.data.map((ride) => (
            <View key={ride.id} style={styles.sep}>
              <RideCard ride={ride} showStatus onPress={() => onOpen(ride.id)} />
            </View>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  headerArea: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: 120, flexGrow: 1 },
  roleSwitcher: { marginBottom: spacing.lg },
  sep: { marginTop: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: { marginBottom: spacing.xs, letterSpacing: 0.5 },
});
