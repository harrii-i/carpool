import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

import { getAccess } from '@/api/tokenStore';
import { config } from '@/config';

export type TrackingStatus =
  | 'connecting'
  | 'waiting' // connected, no location yet
  | 'live'
  | 'stale' // no update in a while
  | 'ended' // ride completed / session ended
  | 'expired' // invalid, expired, or revoked token
  | 'error';

export type LiveLocation = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  updated_at: string;
};

const STALE_AFTER_MS = 12_000; // backend pushes every ~4–5s (§23)
const UPDATE_INTERVAL_MS = 4_000;
const UPDATE_DISTANCE_M = 15;

/**
 * Live ride tracking over /ws/tracking/{token}/ (§23).
 *
 * Both roles connect to the same socket and render the same marker. When
 * `broadcast` is true (the ride's driver), this hook also requests foreground
 * location permission and streams device GPS updates to the server.
 */
export function useTrackingSocket(token: string, broadcast: boolean) {
  const [status, setStatus] = useState<TrackingStatus>('connecting');
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const access = getAccess();
    const url = `${config.wsBase}/ws/tracking/${token}/?token=${access ?? ''}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus((s) => (s === 'connecting' ? 'waiting' : s));
      if (broadcast) void startBroadcasting(ws);
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;
      // Our consumer closes with 4404 for an invalid/expired/revoked token.
      setStatus(event.code === 4404 ? 'expired' : 'ended');
    };

    ws.onerror = () => mountedRef.current && setStatus('error');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'location') {
          lastUpdateRef.current = Date.now();
          setLocation({
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed,
            heading: data.heading,
            updated_at: data.updated_at ?? data.timestamp,
          });
          setStatus('live');
        } else if (data.type === 'ended') {
          setStatus('ended');
        }
      } catch {
        // ignore malformed frames
      }
    };

    // Poll for staleness — no location update for a while while still "live".
    const staleCheck = setInterval(() => {
      if (!lastUpdateRef.current) return;
      setStatus((s) => {
        if (s !== 'live' && s !== 'stale') return s;
        const age = Date.now() - lastUpdateRef.current;
        return age > STALE_AFTER_MS ? 'stale' : 'live';
      });
    }, 3000);

    return () => {
      mountedRef.current = false;
      clearInterval(staleCheck);
      ws.close();
      socketRef.current = null;
      watchRef.current?.remove();
      watchRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, broadcast]);

  async function startBroadcasting(ws: WebSocket) {
    const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
    if (permStatus !== 'granted') {
      if (mountedRef.current) setPermissionDenied(true);
      return;
    }
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: UPDATE_INTERVAL_MS,
        distanceInterval: UPDATE_DISTANCE_M,
      },
      (loc) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(
          JSON.stringify({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed: loc.coords.speed,
            heading: loc.coords.heading,
            timestamp: new Date(loc.timestamp).toISOString(),
          }),
        );
      },
    );
  }

  return { status, location, permissionDenied };
}
