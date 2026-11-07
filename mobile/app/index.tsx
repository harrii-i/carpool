import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

/** Entry redirect; the root layout's guard keeps this in sync afterwards. */
export default function Index() {
  const status = useAuthStore((s) => s.status);
  if (status === 'authenticated') return <Redirect href="/(app)" />;
  return <Redirect href="/(auth)/login" />;
}
