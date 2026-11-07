import { useQuery } from '@tanstack/react-query';
import { Car, Sparkles, Trophy, Users } from 'lucide-react-native';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { pointsApi } from '@/api/rewards';
import type { PointsTransaction, PointsTransactionType } from '@/api/types';
import {
  AppText,
  Card,
  EmptyState,
  ErrorState,
  Header,
  LoadingState,
  Screen,
} from '@/components';
import { formatDeparture } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';

const ICONS: Record<PointsTransactionType, typeof Car> = {
  DRIVER_COMPLETION: Car,
  PASSENGER_COMPLETION: Users,
  ADJUSTMENT: Sparkles,
};

export default function PointsScreen() {
  const summary = useQuery({ queryKey: ['points', 'summary'], queryFn: pointsApi.summary });
  const ledger = useQuery({ queryKey: ['points', 'ledger'], queryFn: pointsApi.list });

  return (
    <Screen padded={false}>
      <View style={styles.headerWrap}>
        <Header title="Points" />
      </View>

      <View style={styles.summaryWrap}>
        <Card style={styles.summaryCard}>
          <Trophy size={28} color={colors.star} strokeWidth={2.2} />
          <AppText variant="display" style={styles.total}>
            {summary.data?.total_points ?? '—'}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            total points · {summary.data?.completed_rides ?? 0} rides completed
          </AppText>
        </Card>
      </View>

      {ledger.isLoading ? (
        <LoadingState label="Loading points…" />
      ) : ledger.isError ? (
        <ErrorState message={toApiError(ledger.error).message} onRetry={ledger.refetch} />
      ) : (
        <FlatList
          data={ledger.data ?? []}
          keyExtractor={(t) => t.id}
          refreshControl={
            <RefreshControl refreshing={ledger.isRefetching} onRefresh={ledger.refetch} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }: { item: PointsTransaction }) => {
            const Icon = ICONS[item.transaction_type] ?? Sparkles;
            const positive = item.points >= 0;
            return (
              <Card style={styles.row}>
                <View style={styles.iconTile}>
                  <Icon size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={styles.rowBody}>
                  <AppText variant="bodyStrong">
                    {item.description || describe(item.transaction_type)}
                  </AppText>
                  <AppText variant="secondary" color={colors.textSecondary}>
                    {formatDeparture(item.created_at)}
                  </AppText>
                </View>
                <AppText variant="cardTitle" color={positive ? colors.success : colors.danger}>
                  {positive ? '+' : ''}
                  {item.points}
                </AppText>
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={<Trophy size={40} color={colors.primary} strokeWidth={2} />}
              title="No points yet"
              message="Complete a ride as a driver or passenger to start earning points."
            />
          }
        />
      )}
    </Screen>
  );
}

function describe(type: PointsTransactionType): string {
  switch (type) {
    case 'DRIVER_COMPLETION':
      return 'Completed a ride as driver';
    case 'PASSENGER_COMPLETION':
      return 'Completed a ride as passenger';
    default:
      return 'Points adjustment';
  }
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.gutter },
  summaryWrap: { paddingHorizontal: spacing.gutter, marginBottom: spacing.lg },
  summaryCard: { alignItems: 'center', gap: spacing.xs },
  total: { marginTop: spacing.xs },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxxl, flexGrow: 1 },
  sep: { height: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
});
