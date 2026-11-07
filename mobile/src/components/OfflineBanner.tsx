import NetInfo from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

/**
 * Persistent top banner shown whenever the device has no connectivity (§42).
 * Mounted once at the root so every screen benefits without extra wiring.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
  }, []);

  if (!offline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + spacing.xs }]}>
      <WifiOff size={14} color={colors.white} strokeWidth={2.4} />
      <AppText variant="caption" color={colors.white}>
        You're offline
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
});
