import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Share2 } from 'lucide-react-native';

import { trackingApi } from '@/api/tracking';
import { AppText, Button, Header, IconButton } from '@/components';
import { CAMPUS } from '@/lib/geo';
import { useTrackingSocket } from '@/lib/useTrackingSocket';
import { colors, radius, spacing } from '@/theme';

const STATUS_LABEL: Record<string, string> = {
  connecting: 'Connecting…',
  waiting: 'Waiting for location…',
  live: 'Live',
  stale: 'Location stale',
  ended: 'Tracking ended',
  expired: 'Share link expired or revoked',
  error: 'Connection error',
};

export default function LiveTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    token: string;
    sessionId?: string;
    role?: string;
    shareUrl?: string;
    origin?: string;
    destination?: string;
    originLat?: string;
    originLng?: string;
    destLat?: string;
    destLng?: string;
  }>();

  const isDriver = params.role === 'driver';
  const { status, location, permissionDenied } = useTrackingSocket(String(params.token), isDriver);
  const mapRef = useRef<MapView>(null);

  const originLat = Number(params.originLat);
  const originLng = Number(params.originLng);
  const destLat = Number(params.destLat);
  const destLng = Number(params.destLng);

  const initialRegion: Region = {
    latitude: Number.isFinite(originLat) ? originLat : CAMPUS.latitude,
    longitude: Number.isFinite(originLng) ? originLng : CAMPUS.longitude,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  useEffect(() => {
    if (location) {
      mapRef.current?.animateToRegion(
        { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        400,
      );
    }
  }, [location?.latitude, location?.longitude]);

  const stopSharing = useMutation({
    mutationFn: () => trackingApi.revoke(String(params.sessionId)),
    onSuccess: () => router.back(),
  });

  const onShare = () => {
    if (!params.shareUrl) return;
    void Share.share({
      message: `Track my ride live: ${params.shareUrl}`,
      url: params.shareUrl,
    });
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <Header
          title="Live ride"
          right={
            params.shareUrl ? (
              <IconButton onPress={onShare}>
                <Share2 size={18} color={colors.ink} strokeWidth={2.2} />
              </IconButton>
            ) : undefined
          }
        />
      </View>

      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>
        {Number.isFinite(originLat) ? (
          <Marker
            coordinate={{ latitude: originLat, longitude: originLng }}
            title={params.origin ?? 'Pickup'}
            pinColor={colors.primary}
          />
        ) : null}
        {Number.isFinite(destLat) ? (
          <Marker
            coordinate={{ latitude: destLat, longitude: destLng }}
            title={params.destination ?? 'Destination'}
            pinColor={colors.danger}
          />
        ) : null}
        {location ? (
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title="Driver"
            pinColor={colors.success}
          />
        ) : null}
      </MapView>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: dotColor(status) }]} />
          <AppText variant="bodyStrong">{STATUS_LABEL[status] ?? status}</AppText>
        </View>

        {permissionDenied ? (
          <AppText variant="caption" color={colors.danger} style={styles.note}>
            Location permission is required to share your position.
          </AppText>
        ) : null}

        {isDriver && params.sessionId ? (
          <Button
            label="Stop sharing"
            variant="secondary"
            loading={stopSharing.isPending}
            onPress={() => stopSharing.mutate()}
            style={styles.action}
          />
        ) : null}
      </View>
    </View>
  );
}

function dotColor(status: string): string {
  if (status === 'live') return colors.success;
  if (status === 'stale') return '#B8860B';
  if (status === 'ended' || status === 'expired' || status === 'error') return colors.danger;
  return colors.textSecondary;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { paddingHorizontal: spacing.gutter, backgroundColor: colors.bg },
  map: { flex: 1 },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  note: { marginTop: 2 },
  action: { marginTop: spacing.sm },
});
