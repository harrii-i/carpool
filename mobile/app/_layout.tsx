import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient, wireOnlineManager } from '@/api/queryClient';
import { setOnAuthExpired } from '@/api/client';
import { LoadingState, OfflineBanner } from '@/components';
import { useAppModeStore } from '@/store/appModeStore';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';

wireOnlineManager();

function useProtectedRoute(status: string) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'anonymous' && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [status, segments, router]);
}

function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    // When a refresh ultimately fails, drop back to anonymous.
    setOnAuthExpired(() => {
      void useAuthStore.getState().logout();
    });
    // Load the persisted Rider/Driver UI preference. Non-blocking: the store
    // already defaults to 'rider', so this only corrects it if a saved
    // 'driver' preference exists — no loading gate needed for a cosmetic
    // preference.
    void useAppModeStore.getState().hydrate();
  }, [hydrate]);

  useProtectedRoute(status);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LoadingState label="Starting up…" />
      </View>
    );
  }
  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <RootNavigator />
          <OfflineBanner />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
