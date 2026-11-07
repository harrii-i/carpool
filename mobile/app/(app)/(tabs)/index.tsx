import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowUpDown,
  Bell,
  ChevronRight,
  Clock,
  Flag,
  LocateFixed,
  MapPin,
  Plus,
  Search,
  Settings as SettingsIcon,
  Star,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { notificationsApi } from '@/api/notifications';
import { bookingsApi, ridesApi } from '@/api/rides';
import type { RideListItem } from '@/api/types';
import {
  ActivityRideCard,
  AppText,
  Avatar,
  Button,
  Card,
  IconButton,
  ModeSwitcher,
  OfferRideCard,
  OfferRideIllustration,
  Screen,
} from '@/components';
import { useAppModeStore } from '@/store/appModeStore';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import type { AccentTone } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = user?.profile;
  const firstName = profile?.name?.split(' ')[0] ?? 'there';

  // Rider/Driver is a mobile-only UI preference — never sent to the backend,
  // never used for authorization. It only changes which sections below are
  // emphasized; both "Find a ride" and "Offer a ride" stay fully reachable
  // in either mode (per product direction).
  const mode = useAppModeStore((s) => s.mode);

  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationsApi.unreadCount,
  });

  // Same query key the Rides tab's "My rides" view uses — the cache is
  // shared, so whichever screen was visited first warms it for the other.
  const history = useQuery({ queryKey: ['rides', 'history'], queryFn: ridesApi.history });

  // A ride's own status (Open/Full/…) isn't what a passenger cares about —
  // they care whether *their seat* is confirmed. Bookings carry that status;
  // cross-reference by ride id (same pattern already used in ride/[id].tsx).
  const bookings = useQuery({ queryKey: ['bookings'], queryFn: bookingsApi.list });
  const bookingStatusByRide = new Map(bookings.data?.map((b) => [b.ride.id, b.status]) ?? []);

  const [origin, setOrigin] = useState('Current location');
  const [destination, setDestination] = useState('');

  const swap = () => {
    setOrigin(destination || 'Current location');
    setDestination(origin === 'Current location' ? '' : origin);
  };

  // The per-ride "role" field (ride.role: 'driver'|'passenger') describes the
  // user's relationship to that specific ride — a separate, backend-computed
  // concept from the global `mode` preference above. We filter by it here
  // purely to decide what to show, not who's allowed to see it.
  const wantedRole = mode === 'driver' ? 'driver' : 'passenger';
  const upcomingActivity: RideListItem[] = [
    ...(history.data?.active ?? []),
    ...(history.data?.upcoming ?? []),
  ].filter((r) => r.role === wantedRole);

  const goToMyRides = () =>
    router.push({ pathname: '/rides', params: { mode: 'mine', role: mode === 'driver' ? 'driver' : 'rider' } });
  const goToCreateRide = () => router.push('/ride/create');
  const goToFindRide = () => router.push('/rides');
  const comingSoon = (feature: string) => Alert.alert(feature, 'This is coming in a later update.');

  return (
    <Screen scroll padded={false} contentStyle={styles.content}>
      {/* Gradient hero: greeting + mode switcher + headline + the active
          mode's primary action float on this band. */}
      <LinearGradient colors={[colors.bgGradientTop, colors.bg]} style={styles.hero}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar name={profile?.name} uri={profile?.profile_image} size={48} />
            <View style={styles.headerText}>
              <AppText variant="heading">Hi, {firstName} 👋</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {profile ? `${profile.department} · ${profile.year_display}` : 'Student'}
              </AppText>
            </View>
          </View>
          <View style={styles.headerActions}>
            <IconButton onPress={() => router.push('/rides')}>
              <Search size={20} color={colors.ink} strokeWidth={2.2} />
            </IconButton>
            <View>
              <IconButton onPress={() => router.push('/notifications')}>
                <Bell size={20} color={colors.ink} strokeWidth={2.2} />
              </IconButton>
              {(unread.data ?? 0) > 0 ? <View style={styles.badgeDot} /> : null}
            </View>
          </View>
        </View>

        <View style={styles.modeRow}>
          <ModeSwitcher />
        </View>

        <View style={styles.headline}>
          <AppText style={typography.hero}>Find a ride,</AppText>
          <AppText style={[typography.hero, { color: colors.primary }]}>go together.</AppText>
          <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
            Safe, affordable and convenient rides for students.
          </AppText>
        </View>

        {mode === 'rider' ? (
          /* Search card — floats over the bottom edge of the gradient */
          <Card style={styles.searchCard}>
            <View style={styles.searchRow}>
              <MapPin size={20} color={colors.ink} strokeWidth={2.2} fill={colors.ink} />
              <View style={styles.searchField}>
                <AppText variant="caption" color={colors.textSecondary}>
                  Going from
                </AppText>
                <TextInput
                  value={origin}
                  onChangeText={setOrigin}
                  style={styles.searchInput}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <IconButton size={40} variant="tint" onPress={() => setOrigin('Current location')}>
                <LocateFixed size={18} color={colors.primary} strokeWidth={2.2} />
              </IconButton>
            </View>

            <View style={styles.divider} />

            <View style={styles.searchRow}>
              <Flag size={20} color={colors.textSecondary} strokeWidth={2.2} />
              <View style={styles.searchField}>
                <AppText variant="caption" color={colors.textSecondary}>
                  Going to
                </AppText>
                <TextInput
                  value={destination}
                  onChangeText={setDestination}
                  placeholder="Where are you headed?"
                  style={styles.searchInput}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <IconButton size={40} onPress={swap}>
                <ArrowUpDown size={18} color={colors.ink} strokeWidth={2.2} />
              </IconButton>
            </View>

            <Button
              label="Find a ride"
              icon={<Search size={18} color={colors.white} strokeWidth={2.4} />}
              trailingIcon={<ChevronRight size={20} color={colors.white} strokeWidth={2.4} />}
              onPress={goToFindRide}
              style={styles.findButton}
            />
          </Card>
        ) : (
          <OfferRideCard onPress={goToCreateRide} />
        )}
      </LinearGradient>

      <View style={styles.body}>
        {/* Upcoming activity — the active mode's role, from the same ride
            history endpoint the Rides tab uses. */}
        <View style={styles.activityHeader}>
          <AppText variant="heading">Upcoming activity</AppText>
          {upcomingActivity.length > 0 ? (
            <Pressable onPress={goToMyRides}>
              <AppText variant="caption" color={colors.primary}>
                See all
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {history.isLoading ? null : upcomingActivity.length === 0 ? (
          <AppText variant="body" color={colors.textSecondary} style={styles.activityEmpty}>
            {mode === 'rider'
              ? "No upcoming rides yet — find one above when you're ready to go."
              : 'No upcoming rides yet — post one above to offer your seats.'}
          </AppText>
        ) : (
          <View style={styles.activityList}>
            {upcomingActivity.slice(0, 3).map((ride) => (
              <ActivityRideCard
                key={ride.id}
                ride={ride}
                bookingStatus={bookingStatusByRide.get(ride.id)}
                onPress={() => router.push(`/ride/${ride.id}`)}
              />
            ))}
          </View>
        )}

        {/* Secondary action — the other capability, always reachable */}
        <View style={styles.tileRow}>
          {mode === 'rider' ? (
            <FeatureTile
              tone="mint"
              icon={<Plus size={20} color={colors.accent.mint.fg} strokeWidth={2.6} />}
              title="Offer a ride"
              description="Have empty seats? Share them with fellow students."
              onPress={goToCreateRide}
              illustration={<OfferRideIllustration />}
            />
          ) : (
            <FeatureTile
              tone="lavender"
              icon={<Search size={20} color={colors.accent.lavender.fg} strokeWidth={2.2} />}
              title="Find a ride"
              description="Search for rides going your way."
              onPress={goToFindRide}
            />
          )}
        </View>

        {/* Quick links */}
        <AppText variant="heading" style={styles.quickLinksTitle}>
          Quick links
        </AppText>
        <View style={styles.quickLinksRow}>
          <QuickLink
            tone="amber"
            icon={<Star size={20} color={colors.accent.amber.fg} strokeWidth={2.2} />}
            label="Saved rides"
            onPress={() => comingSoon('Saved rides')}
          />
          <QuickLink
            tone="rose"
            icon={<Users size={20} color={colors.accent.rose.fg} strokeWidth={2.2} />}
            label="Nearby riders"
            onPress={() => comingSoon('Nearby riders')}
          />
          <QuickLink
            tone="sky"
            icon={<Clock size={20} color={colors.accent.sky.fg} strokeWidth={2.2} />}
            label="Recent trips"
            onPress={goToMyRides}
          />
          <QuickLink
            tone="slate"
            icon={<SettingsIcon size={20} color={colors.accent.slate.fg} strokeWidth={2.2} />}
            label="Settings"
            onPress={() => router.push('/profile')}
          />
        </View>
      </View>
    </Screen>
  );
}

function FeatureTile({
  tone,
  icon,
  title,
  description,
  onPress,
  illustration,
}: {
  tone: AccentTone;
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
  illustration?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, { backgroundColor: colors.accent[tone].bg }, !!illustration && styles.tileTall]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: colors.surface }]}>{icon}</View>
        <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2.2} />
      </View>
      <AppText variant="cardTitle" style={styles.tileTitle}>
        {title}
      </AppText>
      <AppText variant="secondary" color={colors.textSecondary} style={styles.tileDescription}>
        {description}
      </AppText>
      {illustration ? <View style={styles.tileIllustration}>{illustration}</View> : null}
    </Pressable>
  );
}

function QuickLink({
  tone,
  icon,
  label,
  onPress,
}: {
  tone: AccentTone;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickLink}>
      <View style={[styles.quickLinkIcon, { backgroundColor: colors.accent[tone].bg }]}>
        {icon}
      </View>
      <AppText variant="secondary" color={colors.ink} center>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  hero: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.md,
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  headerText: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  modeRow: { marginBottom: spacing.xl },
  headline: { marginBottom: spacing.xxl },
  subtitle: { marginTop: spacing.sm },
  searchCard: { gap: spacing.md, marginBottom: -spacing.xxxl },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  searchField: { flex: 1, gap: 2 },
  searchInput: { ...typography.bodyStrong, color: colors.ink, padding: 0 },
  divider: { height: 1, backgroundColor: colors.border },
  findButton: { marginTop: spacing.xs },
  body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxxl + spacing.lg },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  activityEmpty: { marginBottom: spacing.xl },
  activityList: { gap: spacing.md, marginBottom: spacing.xl },
  tileRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl },
  tile: {
    flex: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.xs,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.subtle,
  },
  tileTitle: { marginTop: spacing.sm },
  tileTall: { minHeight: 170 },
  tileDescription: { maxWidth: '62%' },
  tileIllustration: { position: 'absolute', right: spacing.sm, bottom: spacing.sm },
  quickLinksTitle: { marginBottom: spacing.lg },
  quickLinksRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickLink: { alignItems: 'center', gap: spacing.sm, width: 72 },
  quickLinkIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
