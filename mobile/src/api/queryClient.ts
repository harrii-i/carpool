import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * React Native has no browser `online`/`offline` events, so TanStack Query's
 * default onlineManager assumes the device is always online — meaning
 * `refetchOnReconnect` silently does nothing out of the box. Wiring it to
 * NetInfo makes "refetch when connectivity returns" actually work (§42).
 */
export function wireOnlineManager() {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
  });
}
