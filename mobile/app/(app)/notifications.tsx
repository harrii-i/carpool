import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Bell,
  Car,
  CheckCircle2,
  MessageCircle,
  Star,
  Trophy,
  XCircle,
} from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { notificationsApi } from '@/api/notifications';
import type { AppNotification, NotificationType } from '@/api/types';
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

const ICONS: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  RIDE_REQUEST_RECEIVED: { icon: Bell, color: colors.primary },
  RIDE_REQUEST_ACCEPTED: { icon: CheckCircle2, color: colors.success },
  RIDE_REQUEST_REJECTED: { icon: XCircle, color: colors.danger },
  RIDE_CANCELLED: { icon: XCircle, color: colors.danger },
  NEW_MESSAGE: { icon: MessageCircle, color: colors.primary },
  RIDE_STARTING: { icon: Car, color: colors.primary },
  RIDE_COMPLETED: { icon: CheckCircle2, color: colors.success },
  POINTS_AWARDED: { icon: Trophy, color: colors.star },
  RATING_AVAILABLE: { icon: Star, color: colors.star },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });

  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });

  const open = (n: AppNotification) => {
    if (!n.is_read) markOne.mutate(n.id);
    const rideId = n.data?.ride_id as string | undefined;
    const conversationId = n.data?.conversation_id as string | undefined;
    if (conversationId) router.push(`/chat/${conversationId}`);
    else if (rideId) router.push(`/ride/${rideId}`);
  };

  const hasUnread = (query.data ?? []).some((n) => !n.is_read);

  return (
    <Screen padded={false}>
      <View style={styles.headerWrap}>
        <Header
          title="Notifications"
          right={
            hasUnread ? (
              <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
                <AppText variant="caption" color={colors.primary}>
                  Mark all
                </AppText>
              </Pressable>
            ) : undefined
          }
        />
      </View>

      {query.isLoading ? (
        <LoadingState label="Loading notifications…" />
      ) : query.isError ? (
        <ErrorState message={toApiError(query.error).message} onRetry={query.refetch} />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.primary} />
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const meta = ICONS[item.type] ?? { icon: Bell, color: colors.primary };
            const Icon = meta.icon;
            return (
              <Card onPress={() => open(item)} style={[styles.row, !item.is_read && styles.unread]}>
                <View style={[styles.iconTile, { backgroundColor: `${meta.color}1A` }]}>
                  <Icon size={20} color={meta.color} strokeWidth={2.2} />
                </View>
                <View style={styles.body}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {item.title}
                  </AppText>
                  {item.message ? (
                    <AppText variant="caption" color={colors.textSecondary} numberOfLines={2}>
                      {item.message}
                    </AppText>
                  ) : null}
                  <AppText variant="secondary" color={colors.textSecondary}>
                    {formatDeparture(item.created_at)}
                  </AppText>
                </View>
                {!item.is_read ? <View style={styles.dot} /> : null}
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={<Bell size={40} color={colors.primary} strokeWidth={2} />}
              title="You're all caught up"
              message="Ride updates and messages will show up here."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.gutter },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxxl, flexGrow: 1 },
  sep: { height: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  unread: { borderWidth: 1, borderColor: colors.primaryTint },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
