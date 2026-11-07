import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  Car,
  Coins,
  LogOut,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Card, Screen } from '@/components';
import { useSosTrigger } from '@/lib/useSosTrigger';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing } from '@/theme';
import type { AccentTone } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const logout = useAuthStore((s) => s.logout);
  const profile = user?.profile;
  const { trigger: triggerSos, triggering } = useSosTrigger();

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const confirmSos = () => {
    Alert.alert(
      'Trigger SOS?',
      'This alerts your emergency contacts and may share your live location.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Trigger SOS', style: 'destructive', onPress: () => triggerSos() },
      ],
    );
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">Profile</AppText>
        <Pressable onPress={() => router.push('/profile/edit')} style={styles.editBtn}>
          <Pencil size={14} color={colors.ink} strokeWidth={2.2} />
          <AppText variant="bodyStrong">Edit</AppText>
        </Pressable>
      </View>

      <Card style={styles.identity}>
        <Avatar name={profile?.name} uri={profile?.profile_image} shape="circle" size={88} />
        <AppText variant="heading" style={styles.name}>
          {profile?.name ?? '—'}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {profile ? `${profile.department} · ${profile.year_display}` : ''}
        </AppText>

        {user?.is_verified ? (
          <View style={styles.verifiedBadge}>
            <ShieldCheck size={14} color={colors.success} strokeWidth={2.4} />
            <AppText variant="caption" color={colors.success}>
              Verified student
            </AppText>
          </View>
        ) : null}

        <View style={styles.stats}>
          <Stat
            icon={<Star size={18} color={colors.star} strokeWidth={2.4} />}
            value={profile ? Number(profile.average_rating).toFixed(1) : '—'}
            label="Rating"
          />
          <View style={styles.divider} />
          <Stat
            icon={<Car size={18} color={colors.primary} strokeWidth={2.4} />}
            value={String(profile?.completed_rides ?? 0)}
            label="Rides"
          />
          <View style={styles.divider} />
          <Stat
            icon={<Coins size={18} color={colors.success} strokeWidth={2.4} />}
            value={String(profile?.total_points ?? 0)}
            label="Points"
            onPress={() => router.push('/points')}
          />
        </View>
      </Card>

      <View style={styles.menu}>
        <MenuRow
          tone="sky"
          icon={<Car size={20} color={colors.accent.sky.fg} strokeWidth={2.2} />}
          title="Manage vehicles"
          subtitle="Add or edit your vehicles"
          onPress={() => router.push('/vehicles')}
        />
        <MenuRow
          tone="lavender"
          icon={<Users size={20} color={colors.accent.lavender.fg} strokeWidth={2.2} />}
          title="Emergency contacts"
          subtitle="Manage your trusted contacts"
          onPress={() => router.push('/safety/contacts')}
        />
        <MenuRow
          tone="amber"
          icon={<ShieldAlert size={20} color={colors.accent.amber.fg} strokeWidth={2.2} />}
          title="SOS settings"
          subtitle="Configure safety preferences"
          onPress={() => router.push('/safety/sos-settings')}
        />
      </View>

      <Pressable onPress={confirmSos} disabled={triggering} style={styles.sosCard}>
        <View style={[styles.menuIcon, styles.sosIcon]}>
          <ShieldAlert size={20} color={colors.white} strokeWidth={2.2} />
        </View>
        <View style={styles.menuText}>
          <AppText variant="bodyStrong" color={colors.danger}>
            {triggering ? 'Triggering…' : 'Trigger SOS now'}
          </AppText>
          <AppText variant="secondary" color={colors.danger}>
            Get immediate help
          </AppText>
        </View>
      </Pressable>

      <Pressable onPress={confirmLogout} style={styles.menuRowCard}>
        <View style={[styles.menuIcon, { backgroundColor: colors.accent.rose.bg }]}>
          <LogOut size={20} color={colors.accent.rose.fg} strokeWidth={2.2} />
        </View>
        <View style={styles.menuText}>
          <AppText variant="bodyStrong">Log out</AppText>
        </View>
      </Pressable>

      <AppText variant="secondary" color={colors.textSecondary} center style={styles.email}>
        {user?.email}
      </AppText>
      <AppText variant="secondary" color={colors.textSecondary} center>
        Version {Constants.expoConfig?.version ?? '—'}
      </AppText>
    </Screen>
  );
}

function Stat({
  icon,
  value,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  onPress?: () => void;
}) {
  const children = (
    <>
      {icon}
      <AppText variant="cardTitle" style={styles.statValue}>
        {value}
      </AppText>
      <AppText variant="secondary" color={colors.textSecondary}>
        {label}
      </AppText>
    </>
  );

  // Every column — pressable or not — must get the same `flex: 1` layout
  // style so Rating/Rides/Points stay equal thirds of the row.
  if (!onPress) return <View style={styles.stat}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stat, pressed && { opacity: 0.6 }]}>
      {children}
    </Pressable>
  );
}

function MenuRow({
  tone,
  icon,
  title,
  subtitle,
  onPress,
}: {
  tone: AccentTone;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRowCard, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.menuIcon, { backgroundColor: colors.accent[tone].bg }]}>{icon}</View>
      <View style={styles.menuText}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="secondary" color={colors.textSecondary}>
          {subtitle}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120, paddingTop: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  identity: { alignItems: 'center', gap: spacing.xs },
  name: { marginTop: spacing.sm },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#E6F7EF',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', gap: 2, flex: 1 },
  statValue: { marginTop: spacing.xs },
  divider: { width: 1, height: 36, backgroundColor: colors.border },
  menu: { marginTop: spacing.lg, gap: spacing.md },
  menuRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosIcon: { backgroundColor: colors.danger },
  menuText: { flex: 1, gap: 2 },
  sosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FDE7EA',
    borderRadius: radius.card,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  email: { marginTop: spacing.xl },
});
