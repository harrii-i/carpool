import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { House, MessageCircle, Search, User } from 'lucide-react-native';
import { ComponentType, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/theme';
import { AppText } from './AppText';

type IconProps = { size?: number; color?: string; strokeWidth?: number; fill?: string };
type TabMeta = { label: string; icon: ComponentType<IconProps> };

/** Route-name → tab presentation. Keys match the files in app/(app)/. */
const TAB_META: Record<string, TabMeta> = {
  index: { label: 'Home', icon: House },
  rides: { label: 'Search', icon: Search },
  chat: { label: 'Messages', icon: MessageCircle },
  profile: { label: 'Profile', icon: User },
};

/**
 * Flat bottom tab bar from the reference: the active tab's icon + label sit
 * inside one rounded-rect pill (not just a circle behind the icon), the
 * active icon renders solid/filled, and the bar itself has rounded top
 * corners with a soft shadow rather than a hard divider line.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.xs }]}>
      {state.routes.map((route: (typeof state.routes)[number], index: number) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return <TabBarItem key={route.key} meta={meta} focused={focused} onPress={onPress} />;
      })}
    </View>
  );
}

function TabBarItem({
  meta,
  focused,
  onPress,
}: {
  meta: TabMeta;
  focused: boolean;
  onPress: () => void;
}) {
  const Icon = meta.icon;

  // Pill (wraps icon + label together) fades in on selection.
  const pillOpacity = useSharedValue(focused ? 1 : 0);
  // The icon gets a small, restrained bounce when it becomes active.
  const iconScale = useSharedValue(1);
  // A gentle press-down, not the earlier (too strong) version.
  const pressScale = useSharedValue(1);

  useEffect(() => {
    pillOpacity.value = withTiming(focused ? 1 : 0, { duration: 150 });
    if (focused) {
      iconScale.value = withSequence(
        withSpring(1.08, { damping: 10, stiffness: 300 }),
        withSpring(1, { damping: 12, stiffness: 220 }),
      );
    }
  }, [focused, pillOpacity, iconScale]);

  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOpacity.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressScale.value = withTiming(0.96, { duration: 80 });
      }}
      onPressOut={() => {
        pressScale.value = withTiming(1, { duration: 120 });
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      android_ripple={{ color: 'rgba(61, 90, 254, 0.10)', radius: 56 }}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabContent, pressStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, pillStyle]} />
        <Animated.View style={iconStyle}>
          <Icon
            size={22}
            color={focused ? colors.primary : colors.textSecondary}
            fill={focused ? colors.primary : 'none'}
            strokeWidth={2.1}
          />
        </Animated.View>
        <AppText
          style={[
            typography.secondary,
            styles.label,
            { color: focused ? colors.primary : colors.textSecondary },
            focused && styles.labelActive,
          ]}
        >
          {meta.label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: spacing.md,
    // A bottom-docked bar needs its shadow cast upward (negative height) to
    // separate it from the content above — our shared `shadow.card` casts
    // downward for floating cards, which would be invisible here.
    shadowColor: '#141B3C',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  pill: { backgroundColor: colors.primaryTint, borderRadius: radius.md },
  label: { marginTop: 2 },
  labelActive: { fontFamily: typography.bodyStrong.fontFamily },
});
