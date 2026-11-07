import { Stack } from 'expo-router';

import { colors } from '@/theme';

/**
 * Authenticated stack: the tab bar lives in the (tabs) group; ride details,
 * create-ride and vehicle screens push on top of it.
 */
export default function AppStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="ride/[id]" />
      <Stack.Screen name="ride/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="vehicles/index" />
      <Stack.Screen name="vehicles/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="safety/contacts/index" />
      <Stack.Screen name="safety/contacts/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="safety/sos-settings" />
      <Stack.Screen name="tracking/[token]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="points" />
      <Stack.Screen name="profile/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="ride/rate" options={{ presentation: 'modal' }} />
      <Stack.Screen name="report" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
