import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowDownUp,
  MessageCircle,
  Search,
  UserCheck,
  X,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { toApiError } from '@/api/client';
import { chatApi } from '@/api/chat';
import { requestsApi } from '@/api/rides';
import type { Conversation, RideRequest } from '@/api/types';
import {
  AppText,
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
  SegmentedControl,
} from '@/components';
import { formatMessageTime } from '@/lib/format';
import { RIDE_STATUS_META } from '@/lib/rideStatusMeta';
import { colors, radius, spacing } from '@/theme';

type Tab = 'chats' | 'requests';

function conversationDisplayName(item: Conversation): string {
  // Defensive: tolerate an older/un-upgraded backend that doesn't send this
  // field yet, rather than crashing the whole screen.
  const others = item.other_participants ?? [];
  const primary = others[0];
  if (!primary) return 'Ride chat';
  return others.length > 1 ? `${primary.name} +${others.length - 1}` : primary.name;
}

export default function ChatListScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('chats');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [unreadFirst, setUnreadFirst] = useState(false);

  const conversations = useQuery({ queryKey: ['conversations'], queryFn: chatApi.conversations });
  const requests = useQuery({
    queryKey: ['ride-requests', 'incoming-all'],
    queryFn: requestsApi.listIncoming,
  });

  useFocusEffect(
    useCallback(() => {
      void conversations.refetch();
      void requests.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const pendingRequests = (requests.data ?? []).filter((r) => r.status === 'PENDING');

  const visibleConversations = (() => {
    const q = search.trim().toLowerCase();
    let list = conversations.data ?? [];
    if (q) {
      list = list.filter(
        (c) => c.origin.toLowerCase().includes(q) || c.destination.toLowerCase().includes(q),
      );
    }
    if (unreadFirst) {
      list = [...list].sort((a, b) => Number(b.unread_count > 0) - Number(a.unread_count > 0));
    }
    return list;
  })();

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText variant="title">Messages</AppText>
        {tab === 'chats' ? (
          <View style={styles.headerActions}>
            <IconButton
              variant={searchOpen ? 'tint' : 'surface'}
              onPress={() => {
                setSearchOpen((s) => !s);
                if (searchOpen) setSearch('');
              }}
            >
              <Search size={18} color={colors.ink} strokeWidth={2.2} />
            </IconButton>
            <IconButton
              variant={unreadFirst ? 'tint' : 'surface'}
              onPress={() => setUnreadFirst((s) => !s)}
            >
              <ArrowDownUp size={18} color={colors.ink} strokeWidth={2.2} />
            </IconButton>
          </View>
        ) : null}
      </View>

      {searchOpen && tab === 'chats' ? (
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textSecondary} strokeWidth={2.2} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            autoFocus
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <X size={16} color={colors.textSecondary} strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.tabsWrap}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'chats', label: 'Chats' },
            {
              value: 'requests',
              label: pendingRequests.length > 0 ? `Requests (${pendingRequests.length})` : 'Requests',
            },
          ]}
        />
      </View>

      {tab === 'chats' ? (
        <ChatsList
          query={conversations}
          data={visibleConversations}
          onOpen={(c) => {
            const primary = (c.other_participants ?? [])[0];
            router.push({
              pathname: '/chat/[id]',
              params: {
                id: c.id,
                title: conversationDisplayName(c),
                rideId: c.ride_id,
                participantId: primary?.id ?? '',
                participantName: primary?.name ?? '',
                participantAvatar: primary?.profile_image ?? '',
              },
            });
          }}
        />
      ) : (
        <RequestsList
          query={requests}
          data={pendingRequests}
          onOpen={(r) => router.push(`/ride/${r.ride}`)}
        />
      )}
    </Screen>
  );
}

function ChatsList({
  query,
  data,
  onOpen,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => void; isRefetching: boolean };
  data: Conversation[];
  onOpen: (c: Conversation) => void;
}) {
  if (query.isLoading) return <LoadingState label="Loading conversations…" />;
  if (query.isError) {
    return <ErrorState message={toApiError(query.error).message} onRetry={query.refetch} />;
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.primary} />
      }
      renderItem={({ item }) => <ConversationRow item={item} onPress={() => onOpen(item)} />}
      ListEmptyComponent={
        <EmptyState
          icon={<MessageCircle size={40} color={colors.primary} strokeWidth={2} />}
          title="No conversations yet"
          message="Chats open automatically once you're confirmed on a ride."
        />
      }
    />
  );
}

function ConversationRow({ item, onPress }: { item: Conversation; onPress: () => void }) {
  const unread = item.unread_count > 0;
  const statusDot = RIDE_STATUS_META[item.ride_status]?.dot ?? colors.textSecondary;
  const primary = (item.other_participants ?? [])[0];
  const displayName = conversationDisplayName(item);

  return (
    <Card onPress={onPress} style={styles.row}>
      <View style={styles.avatarWrap}>
        <Avatar name={primary?.name} uri={primary?.profile_image} shape="circle" size={48} />
        <View style={[styles.statusDot, { backgroundColor: statusDot }]} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.route}>
            {displayName}
          </AppText>
          {item.last_message ? (
            <AppText variant="secondary" color={colors.textSecondary}>
              {formatMessageTime(item.last_message.created_at)}
            </AppText>
          ) : null}
        </View>

        <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
          {item.origin} → {item.destination}
        </AppText>

        <View style={styles.rowBottom}>
          <AppText
            variant="body"
            color={unread ? colors.ink : colors.textSecondary}
            numberOfLines={1}
            style={styles.preview}
          >
            {item.last_message ? item.last_message.message : 'No messages yet'}
          </AppText>
          {unread ? (
            <View style={styles.badge}>
              <AppText variant="secondary" color={colors.white}>
                {item.unread_count}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function RequestsList({
  query,
  data,
  onOpen,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => void; isRefetching: boolean };
  data: RideRequest[];
  onOpen: (r: RideRequest) => void;
}) {
  if (query.isLoading) return <LoadingState label="Loading requests…" />;
  if (query.isError) {
    return <ErrorState message={toApiError(query.error).message} onRetry={query.refetch} />;
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.primary} />
      }
      renderItem={({ item }) => (
        <Card onPress={() => onOpen(item)} style={styles.requestRow}>
          <Avatar name={item.rider.name} uri={item.rider.profile_image} shape="circle" size={48} />
          <View style={styles.rowBody}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {item.rider.name}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
              Requested to join your ride · {formatMessageTime(item.created_at)}
            </AppText>
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <EmptyState
          icon={<UserCheck size={40} color={colors.primary} strokeWidth={2} />}
          title="No pending requests"
          message="When someone asks to join a ride you're driving, it'll show up here."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.gutter,
    marginBottom: spacing.sm,
    backgroundColor: colors.chipBg,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.ink, padding: 0 },
  tabsWrap: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.gutter, paddingBottom: 120, flexGrow: 1 },
  sep: { height: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  statusDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  route: { flex: 1 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  preview: { flex: 1 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
