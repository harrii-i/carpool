import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Flag, MapPinned, Star, Users } from 'lucide-react-native';
import { Alert, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { bookingsApi, requestsApi, ridesApi } from '@/api/rides';
import { trackingApi } from '@/api/tracking';
import type { RideRequest } from '@/api/types';
import {
  AppText,
  Avatar,
  Button,
  Card,
  ErrorState,
  Header,
  LoadingState,
  RouteLine,
  Screen,
  SosButton,
  StatusBadge,
} from '@/components';
import { formatContribution, formatDeparture, formatRating } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = String(id);
  const router = useRouter();
  const qc = useQueryClient();

  const detail = useQuery({ queryKey: ['ride', rideId], queryFn: () => ridesApi.detail(rideId) });
  const ride = detail.data;

  const requests = useQuery({
    queryKey: ['ride', rideId, 'requests'],
    queryFn: () => requestsApi.listForRide(rideId),
    enabled: !!ride?.is_driver,
  });

  const bookings = useQuery({
    queryKey: ['bookings'],
    queryFn: bookingsApi.list,
    enabled: ride?.my_booking_status === 'CONFIRMED',
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ride', rideId] });
    qc.invalidateQueries({ queryKey: ['rides'] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
  };

  const onError = (err: unknown) => Alert.alert('Something went wrong', toApiError(err).message);

  const requestJoin = useMutation({
    mutationFn: () => requestsApi.create(rideId),
    onSuccess: invalidate,
    onError,
  });
  const accept = useMutation({
    mutationFn: (reqId: string) => requestsApi.accept(reqId),
    onSuccess: invalidate,
    onError,
  });
  const reject = useMutation({
    mutationFn: (reqId: string) => requestsApi.reject(reqId),
    onSuccess: invalidate,
    onError,
  });
  const startRide = useMutation({ mutationFn: () => ridesApi.start(rideId), onSuccess: invalidate, onError });
  const completeRide = useMutation({ mutationFn: () => ridesApi.complete(rideId), onSuccess: invalidate, onError });
  const cancelRide = useMutation({ mutationFn: () => ridesApi.cancel(rideId), onSuccess: invalidate, onError });
  const cancelBooking = useMutation({
    mutationFn: (bookingId: string) => bookingsApi.cancel(bookingId),
    onSuccess: invalidate,
    onError,
  });
  const shareRide = useMutation({
    mutationFn: () => trackingApi.createSession(rideId),
    onSuccess: (session) => {
      if (!ride) return;
      router.push({
        pathname: '/tracking/[token]',
        params: {
          token: session.share_token,
          sessionId: session.id,
          role: ride.is_driver ? 'driver' : 'viewer',
          shareUrl: session.share_url,
          origin: ride.origin,
          destination: ride.destination,
          originLat: String(ride.origin_latitude),
          originLng: String(ride.origin_longitude),
          destLat: String(ride.destination_latitude),
          destLng: String(ride.destination_longitude),
        },
      });
    },
    onError,
  });

  if (detail.isLoading) {
    return (
      <Screen>
        <Header title="Ride" />
        <LoadingState label="Loading ride…" />
      </Screen>
    );
  }
  if (detail.isError || !ride) {
    return (
      <Screen>
        <Header title="Ride" />
        <ErrorState
          message={detail.error ? toApiError(detail.error).message : undefined}
          onRetry={detail.refetch}
        />
      </Screen>
    );
  }

  const pending = (requests.data ?? []).filter((r) => r.status === 'PENDING');
  const myBooking = (bookings.data ?? []).find(
    (b) => b.ride.id === rideId && b.status === 'CONFIRMED',
  );
  const isParticipant =
    ride.is_driver || ride.my_booking_status === 'CONFIRMED' || ride.my_request_status === 'PENDING';
  const canShareLive =
    ride.status === 'STARTED' && (ride.is_driver || ride.my_booking_status === 'CONFIRMED');

  return (
    <Screen scroll padded={false}>
      <View style={styles.headerWrap}>
        <Header
          title="Ride details"
          right={isParticipant ? <SosButton rideId={rideId} size={40} /> : undefined}
        />
      </View>

      <View style={styles.body}>
        {/* Route + facts */}
        <Card style={styles.block}>
          <StatusBadge status={ride.status} />
          <RouteLine origin={ride.origin} destination={ride.destination} />
          <View style={styles.factRow}>
            <Fact icon={<Clock size={16} color={colors.textSecondary} strokeWidth={2.2} />} text={formatDeparture(ride.departure_time)} />
            <Fact icon={<Users size={16} color={colors.textSecondary} strokeWidth={2.2} />} text={`${ride.available_seats}/${ride.total_seats} seats`} />
            <AppText variant="bodyStrong" color={colors.primary}>
              {formatContribution(ride.contribution_amount)}
            </AppText>
          </View>
          {ride.notes ? (
            <AppText variant="body" color={colors.textSecondary} style={styles.notes}>
              {ride.notes}
            </AppText>
          ) : null}
        </Card>

        {/* Driver + vehicle */}
        <Card style={styles.block}>
          <View style={styles.driverRow}>
            <Avatar name={ride.driver.name} uri={ride.driver.profile_image} size={52} />
            <View style={styles.driverInfo}>
              <AppText variant="cardTitle">{ride.driver.name}</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {ride.driver.department} · Year {ride.driver.year}
              </AppText>
            </View>
            <View style={styles.rating}>
              <Star size={16} color={colors.star} strokeWidth={2.4} />
              <AppText variant="bodyStrong">{formatRating(ride.driver.average_rating)}</AppText>
            </View>
          </View>
          <View style={styles.vehicleTag}>
            <AppText variant="caption" color={colors.textSecondary}>
              {ride.vehicle.vehicle_type_display} · {ride.vehicle.brand} {ride.vehicle.model} · {ride.vehicle.color}
            </AppText>
          </View>
          {!ride.is_driver ? (
            <Button
              label="Report"
              variant="ghost"
              size="md"
              fullWidth={false}
              icon={<Flag size={16} color={colors.danger} strokeWidth={2.2} />}
              onPress={() =>
                router.push({
                  pathname: '/report',
                  params: { rideId, reportedUserId: ride.driver.id, name: ride.driver.name },
                })
              }
              style={styles.reportBtn}
            />
          ) : null}
        </Card>

        {/* Driver: incoming requests */}
        {ride.is_driver ? (
          <View style={styles.block}>
            <AppText variant="heading" style={styles.sectionTitle}>
              Requests {pending.length ? `(${pending.length})` : ''}
            </AppText>
            {pending.length === 0 ? (
              <Card>
                <AppText variant="body" color={colors.textSecondary}>
                  No pending requests.
                </AppText>
              </Card>
            ) : (
              pending.map((req: RideRequest) => (
                <Card key={req.id} style={styles.requestCard}>
                  <View style={styles.driverRow}>
                    <Avatar name={req.rider.name} uri={req.rider.profile_image} size={40} />
                    <View style={styles.driverInfo}>
                      <AppText variant="bodyStrong">{req.rider.name}</AppText>
                      <AppText variant="secondary" color={colors.textSecondary}>
                        {req.rider.department} · Year {req.rider.year}
                      </AppText>
                    </View>
                  </View>
                  <View style={styles.requestActions}>
                    <Button label="Decline" variant="secondary" fullWidth={false} size="md" onPress={() => reject.mutate(req.id)} style={styles.flex1} />
                    <Button label="Accept" size="md" fullWidth={false} loading={accept.isPending} onPress={() => accept.mutate(req.id)} style={styles.flex1} />
                  </View>
                </Card>
              ))
            )}
          </View>
        ) : null}
      </View>

      {/* Action bar */}
      <View style={styles.actions}>
        {renderActions()}
      </View>
    </Screen>
  );

  function renderActions() {
    if (ride!.status === 'COMPLETED' && isParticipant) {
      return (
        <Button
          label="Rate your ride"
          icon={<Star size={18} color={colors.white} strokeWidth={2.2} fill={colors.white} />}
          onPress={() => router.push({ pathname: '/ride/rate', params: { rideId } })}
        />
      );
    }

    // Driver lifecycle controls
    if (ride!.is_driver) {
      if (ride!.status === 'OPEN' || ride!.status === 'FULL') {
        return (
          <View style={styles.actionRow}>
            <Button label="Cancel ride" variant="secondary" fullWidth={false} onPress={confirmCancelRide} style={styles.flex1} />
            <Button label="Start ride" fullWidth={false} loading={startRide.isPending} onPress={() => startRide.mutate()} style={styles.flex1} />
          </View>
        );
      }
      if (ride!.status === 'STARTED') {
        return (
          <View style={styles.actionRow}>
            <Button
              label="Share live ride"
              variant="secondary"
              fullWidth={false}
              icon={<MapPinned size={18} color={colors.ink} strokeWidth={2.2} />}
              loading={shareRide.isPending}
              onPress={() => shareRide.mutate()}
              style={styles.flex1}
            />
            <Button label="Complete ride" fullWidth={false} loading={completeRide.isPending} onPress={() => completeRide.mutate()} style={styles.flex1} />
          </View>
        );
      }
      return null;
    }

    // Passenger states
    if (ride!.my_booking_status === 'CONFIRMED') {
      if (canShareLive) {
        return (
          <Button
            label="Track live location"
            icon={<MapPinned size={18} color={colors.white} strokeWidth={2.2} />}
            loading={shareRide.isPending}
            onPress={() => shareRide.mutate()}
          />
        );
      }
      return (
        <View style={styles.actionRow}>
          {myBooking ? (
            <Button label="Cancel seat" variant="secondary" fullWidth={false} loading={cancelBooking.isPending} onPress={() => confirmCancelBooking(myBooking.id)} style={styles.flex1} />
          ) : null}
          <Button label="You're booked ✓" fullWidth={!myBooking} disabled style={myBooking ? styles.flex1 : undefined} />
        </View>
      );
    }
    if (ride!.my_request_status === 'PENDING') {
      return <Button label="Requested — awaiting driver" variant="secondary" disabled />;
    }
    if (ride!.status === 'OPEN' && ride!.available_seats > 0) {
      return (
        <View style={styles.requestAgainWrap}>
          {ride!.my_request_status === 'REJECTED' ? (
            <AppText variant="caption" color={colors.danger} center>
              Your previous request was declined by the driver.
            </AppText>
          ) : null}
          <Button label="Request to join" loading={requestJoin.isPending} onPress={() => requestJoin.mutate()} />
        </View>
      );
    }
    return <Button label="Not available" variant="secondary" disabled />;
  }

  function confirmCancelRide() {
    Alert.alert('Cancel ride?', 'Passengers will be notified and seats released.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel ride', style: 'destructive', onPress: () => cancelRide.mutate() },
    ]);
  }

  function confirmCancelBooking(bookingId: string) {
    Alert.alert('Cancel your seat?', 'This frees the seat for others.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel seat', style: 'destructive', onPress: () => cancelBooking.mutate(bookingId) },
    ]);
  }
}

function Fact({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.fact}>
      {icon}
      <AppText variant="caption" color={colors.textSecondary}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.gutter },
  body: { paddingHorizontal: spacing.gutter, gap: spacing.lg },
  block: { gap: spacing.md },
  factRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  notes: { marginTop: spacing.xs },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  driverInfo: { flex: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  vehicleTag: {
    backgroundColor: colors.chipBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionTitle: { marginBottom: spacing.xs },
  reportBtn: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: 0 },
  requestAgainWrap: { gap: spacing.sm },
  requestCard: { gap: spacing.md, marginTop: spacing.sm },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  actions: { padding: spacing.gutter, paddingBottom: 120 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
});
