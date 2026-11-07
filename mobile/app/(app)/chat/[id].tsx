import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  Car,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Cloud,
  MapPin,
  MoreVertical,
  SendHorizontal,
  Sparkle,
  TreePine,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ridesApi } from '@/api/rides';
import { AppText, Avatar, IconButton } from '@/components';
import { formatDeparture } from '@/lib/format';
import { RIDE_STATUS_META } from '@/lib/rideStatusMeta';
import { LocalChatMessage, useChatSocket } from '@/lib/useChatSocket';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    rideId?: string;
    participantId?: string;
    participantName?: string;
    participantAvatar?: string;
  }>();
  const conversationId = String(params.id);
  const userId = useAuthStore((s) => s.user?.id);
  const insets = useSafeAreaInsets();

  const { messages, status, send, retry, loadingHistory } = useChatSocket(conversationId, userId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<LocalChatMessage>>(null);

  const ride = useQuery({
    queryKey: ['ride', params.rideId],
    queryFn: () => ridesApi.detail(String(params.rideId)),
    enabled: !!params.rideId,
  });

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    send(text);
  };

  const statusMeta = ride.data ? RIDE_STATUS_META[ride.data.status] : null;

  const openMenu = () => {
    const options: { text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }[] = [];
    if (params.rideId) {
      options.push({ text: 'View ride details', onPress: () => router.push(`/ride/${params.rideId}`) });
    }
    if (params.participantId) {
      options.push({
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          router.push({
            pathname: '/report',
            params: {
              rideId: params.rideId,
              reportedUserId: params.participantId,
              name: params.participantName,
            },
          }),
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Conversation options', undefined, options);
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.headerWrap, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.headerRow}>
          <IconButton onPress={() => router.back()} size={40}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
          </IconButton>
          <Avatar
            name={params.participantName}
            uri={params.participantAvatar || null}
            shape="circle"
            size={40}
          />
          <View style={styles.headerText}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {params.participantName || params.title || 'Chat'}
            </AppText>
            {statusMeta ? (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusMeta.dot }]} />
                <AppText variant="secondary" color={colors.textSecondary}>
                  {status !== 'open' ? 'Reconnecting…' : statusMeta.label}
                </AppText>
              </View>
            ) : null}
          </View>
          <IconButton onPress={openMenu} size={40}>
            <MoreVertical size={18} color={colors.ink} strokeWidth={2.2} />
          </IconButton>
        </View>

        {ride.data ? (
          <Pressable
            onPress={() => router.push(`/ride/${params.rideId}`)}
            style={styles.ridePill}
          >
            <View style={styles.ridePillIcon}>
              <Car size={18} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.ridePillText}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {ride.data.origin} → {ride.data.destination}
              </AppText>
              <AppText variant="secondary" color={colors.textSecondary}>
                {formatDeparture(ride.data.departure_time)}
              </AppText>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      {loadingHistory ? (
        <View style={styles.flex} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          // Android's "padding" behavior is unreliable across OEM keyboard
          // implementations (works on some devices, not others) — "height"
          // is the well-established reliable choice there. Our custom header
          // sits above this view (not overlapping it), so no vertical offset
          // is needed on either platform.
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.listWrap}>
            <DecorativeBackdrop />
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <Bubble message={item} onRetry={retry} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <AppText variant="body" color={colors.textSecondary} center>
                    Say hello 👋
                  </AppText>
                </View>
              }
            />
          </View>

          <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor={colors.textSecondary}
              multiline
              onSubmitEditing={onSend}
            />
            <Pressable
              onPress={onSend}
              disabled={!draft.trim()}
              style={[styles.sendBtn, !draft.trim() && styles.sendDisabled]}
            >
              <SendHorizontal size={20} color={colors.white} strokeWidth={2.2} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

/** Purely decorative, low-opacity carpool-themed icons behind the messages —
 * no data behind it, matching only the reference's background pattern. */
function DecorativeBackdrop() {
  const icons: { Icon: typeof Car; top: number; left?: number; right?: number; size: number }[] = [
    { Icon: MapPin, top: 40, left: 24, size: 28 },
    { Icon: Cloud, top: 90, right: 40, size: 26 },
    { Icon: Car, top: 220, left: 50, size: 30 },
    { Icon: TreePine, top: 180, right: 20, size: 24 },
    { Icon: Sparkle, top: 320, right: 70, size: 18 },
    { Icon: TreePine, top: 420, left: 20, size: 22 },
    { Icon: MapPin, top: 480, right: 36, size: 22 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {icons.map(({ Icon, top, left, right, size }, i) => (
        <Icon
          key={i}
          size={size}
          color={colors.border}
          strokeWidth={1.6}
          style={{ position: 'absolute', top, left, right }}
        />
      ))}
    </View>
  );
}

function Bubble({
  message,
  onRetry,
}: {
  message: LocalChatMessage;
  onRetry: (localId: string) => void;
}) {
  const mine = message.is_mine;
  const failed = message.sendStatus === 'failed';
  const sending = message.sendStatus === 'sending';
  const read = !!message.read_at;
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const bubble = (
    <View
      style={[
        styles.bubble,
        mine ? styles.mine : styles.theirs,
        failed && styles.bubbleFailed,
        sending && styles.bubbleSending,
      ]}
    >
      <AppText variant="body" color={mine ? colors.white : colors.ink}>
        {message.message}
      </AppText>
    </View>
  );

  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      {failed && message.localId ? (
        <Pressable onPress={() => onRetry(message.localId!)}>{bubble}</Pressable>
      ) : (
        bubble
      )}
      {failed ? (
        <AppText variant="secondary" color={colors.danger} style={styles.time}>
          Failed to send · Tap to retry
        </AppText>
      ) : sending ? (
        <AppText variant="secondary" color={colors.textSecondary} style={styles.time}>
          Sending…
        </AppText>
      ) : (
        <View style={styles.receiptRow}>
          <AppText variant="secondary" color={colors.textSecondary}>
            {time}
          </AppText>
          {mine ? (
            read ? (
              <CheckCheck size={14} color={colors.primary} strokeWidth={2.4} />
            ) : (
              <Check size={14} color={colors.textSecondary} strokeWidth={2.4} />
            )
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  headerWrap: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  ridePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  ridePillIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ridePillText: { flex: 1, gap: 1 },
  listWrap: { flex: 1 },
  list: { padding: spacing.gutter, gap: spacing.md, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubbleRow: { maxWidth: '82%', gap: 2 },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.card },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: spacing.xs },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: spacing.xs },
  bubbleSending: { opacity: 0.6 },
  bubbleFailed: { borderWidth: 1, borderColor: colors.danger },
  time: { marginHorizontal: spacing.xs },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: spacing.xs },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    ...typography.body,
    color: colors.ink,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
