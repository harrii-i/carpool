import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  Armchair,
  Bike,
  Calendar,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  FileText,
  IndianRupee,
  MapPin,
  Settings,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '@/api/client';
import { ridesApi } from '@/api/rides';
import { vehiclesApi } from '@/api/vehicles';
import type { Vehicle } from '@/api/types';
import { AppText, Button, Card, IconButton, Screen, Stepper } from '@/components';
import { CAMPUS } from '@/lib/geo';
import { colors, radius, shadow, spacing } from '@/theme';

function defaultDeparture(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return d;
}

function withDatePart(base: Date, datePart: Date): Date {
  const d = new Date(base);
  d.setFullYear(datePart.getFullYear(), datePart.getMonth(), datePart.getDate());
  return d;
}

function withTimePart(base: Date, timePart: Date): Date {
  const d = new Date(base);
  d.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return d;
}

export default function CreateRideScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();

  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: vehiclesApi.list });
  const activeVehicles = (vehicles.data ?? []).filter((v) => v.is_active);

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originPoint, setOriginPoint] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [locatingOrigin, setLocatingOrigin] = useState(false);
  const [departure, setDeparture] = useState<Date>(defaultDeparture());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [seats, setSeats] = useState(1);
  const [contribution, setContribution] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Field-level validation state, used to point the user at exactly what's
  // missing instead of just disabling the submit button (better UX).
  const [vehicleError, setVehicleError] = useState(false);
  const [originError, setOriginError] = useState<string | null>(null);
  const [destinationError, setDestinationError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const originRef = useRef<TextInput>(null);
  const destinationRef = useRef<TextInput>(null);

  const selectedVehicle = activeVehicles.find((v) => v.id === vehicleId) ?? null;
  const maxSeats = selectedVehicle?.seat_capacity ?? 8;

  // Default to the rider's only (or first) vehicle so the vehicle card has
  // something to show without making them pick on a fresh visit — they can
  // still switch via the chevron if they own more than one.
  useEffect(() => {
    if (!vehicleId && activeVehicles.length > 0) {
      setVehicleId(activeVehicles[0].id);
    }
  }, [activeVehicles, vehicleId]);

  const create = useMutation({
    mutationFn: () =>
      ridesApi.create({
        vehicle_id: vehicleId!,
        origin: origin.trim(),
        destination: destination.trim(),
        // Real device location when "use current location" was tapped;
        // otherwise anchor to campus. Destination has no equivalent — we
        // have no geocoding/maps API key wired up to turn a typed place name
        // into coordinates, so it stays a placeholder until that's added.
        origin_latitude: originPoint?.latitude ?? CAMPUS.latitude,
        origin_longitude: originPoint?.longitude ?? CAMPUS.longitude,
        destination_latitude: CAMPUS.latitude + 0.03,
        destination_longitude: CAMPUS.longitude + 0.02,
        departure_time: departure.toISOString(),
        available_seats: seats,
        contribution_amount: contribution ? Number(contribution) : null,
        notes: notes.trim(),
      }),
    onSuccess: (ride) => {
      qc.invalidateQueries({ queryKey: ['rides'] });
      router.replace(`/ride/${ride.id}`);
    },
    onError: (e) => setError(toApiError(e).message),
  });

  const useCurrentLocationForOrigin = async () => {
    setLocatingOrigin(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to use your current location.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setOriginPoint({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setOrigin('Current location');
      setOriginError(null);
    } catch {
      setError('Could not get your current location.');
    } finally {
      setLocatingOrigin(false);
    }
  };

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: departure,
        mode: 'date',
        minimumDate: new Date(),
        onChange: (_e, date) => date && setDeparture((prev) => withDatePart(prev, date)),
      });
    } else {
      setShowDatePicker((s) => !s);
      setShowTimePicker(false);
    }
  };

  const openTimePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: departure,
        mode: 'time',
        onChange: (_e, time) => time && setDeparture((prev) => withTimePart(prev, time)),
      });
    } else {
      setShowTimePicker((s) => !s);
      setShowDatePicker(false);
    }
  };

  /**
   * Vehicle, Pickup and Destination are always the first fields on this
   * form, so jumping to the top of the scroll view always brings whichever
   * one is missing into view; we then also focus/highlight that specific
   * field so it's unmistakable what needs attention.
   */
  const handleSubmit = () => {
    setError(null);

    if (!vehicleId) {
      setVehicleError(true);
      setOriginError(null);
      setDestinationError(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setVehicleError(false);

    if (!origin.trim()) {
      setOriginError('Enter a pickup location');
      setDestinationError(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => originRef.current?.focus(), 350);
      return;
    }
    setOriginError(null);

    if (!destination.trim()) {
      setDestinationError('Enter a destination');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => destinationRef.current?.focus(), 350);
      return;
    }
    setDestinationError(null);

    create.mutate();
  };

  if (vehicles.isLoading) {
    return (
      <Screen>
        <ScreenHeader onBack={() => router.back()} />
        <ActivityIndicator style={{ marginTop: spacing.xxxl }} color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen scroll ref={scrollRef}>
      <ScreenHeader onBack={() => router.back()} />

      {activeVehicles.length === 0 ? (
        <Card style={styles.noVehicle}>
          <AppText variant="cardTitle">Become a driver</AppText>
          <AppText variant="body" color={colors.textSecondary}>
            Add your vehicle to start offering rides.
          </AppText>
          <Button label="Add vehicle" fullWidth={false} onPress={() => router.push('/vehicles/new')} />
        </Card>
      ) : (
        <View style={styles.form}>
          {/* Vehicle */}
          <View style={styles.sectionHeader}>
            <AppText variant="bodyStrong">Vehicle</AppText>
            <Pressable onPress={() => router.push('/vehicles')} style={styles.manageLink}>
              <AppText variant="caption" color={colors.primary}>
                Manage
              </AppText>
              <ChevronDown size={14} color={colors.primary} strokeWidth={2.4} style={styles.manageChevron} />
            </Pressable>
          </View>

          {selectedVehicle ? (
            <View style={[styles.vehicleCard, vehicleError && styles.vehicleCardErrored]}>
              <View style={styles.vehicleIcon}>
                {selectedVehicle.vehicle_type === 'BIKE' ? (
                  <Bike size={22} color={colors.primary} strokeWidth={2.2} />
                ) : (
                  <Car size={22} color={colors.primary} strokeWidth={2.2} />
                )}
              </View>
              <View style={styles.vehicleText}>
                <AppText variant="bodyStrong">
                  {selectedVehicle.brand} {selectedVehicle.model}
                </AppText>
                <AppText variant="secondary" color={colors.textSecondary}>
                  {selectedVehicle.vehicle_type_display} · {selectedVehicle.seat_capacity} seat
                  {selectedVehicle.seat_capacity === 1 ? '' : 's'}
                </AppText>
              </View>
              {/* No dedicated "edit this vehicle" screen exists yet — routes
                  to vehicle management, same as "Manage" above, for now. */}
              <IconButton size={36} onPress={() => router.push('/vehicles')}>
                <Settings size={16} color={colors.textSecondary} strokeWidth={2.2} />
              </IconButton>
              {activeVehicles.length > 1 ? (
                <IconButton size={36} onPress={() => setVehiclePickerOpen(true)}>
                  <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2.2} />
                </IconButton>
              ) : null}
            </View>
          ) : null}
          {vehicleError ? (
            <AppText variant="caption" color={colors.danger}>
              Select a vehicle to continue
            </AppText>
          ) : null}

          {/* Trip details */}
          <AppText variant="bodyStrong" style={styles.sectionTitleOnly}>
            Trip details
          </AppText>
          <View style={[styles.tripCard, (originError || destinationError) && styles.tripCardErrored]}>
            <View style={styles.tripRow}>
              <View style={styles.tripDots}>
                <View style={styles.dotFilled} />
                <View style={styles.dotConnector} />
              </View>
              <View style={styles.tripField}>
                <AppText variant="caption" color={colors.textSecondary}>
                  Where from?
                </AppText>
                <TextInput
                  ref={originRef}
                  value={origin}
                  onChangeText={(t) => {
                    setOrigin(t);
                    if (t !== 'Current location') setOriginPoint(null);
                    if (originError) setOriginError(null);
                  }}
                  placeholder="Select pickup location"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.tripInput}
                />
              </View>
              <IconButton size={40} onPress={useCurrentLocationForOrigin}>
                {locatingOrigin ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MapPin size={18} color={colors.primary} strokeWidth={2.2} />
                )}
              </IconButton>
            </View>

            <View style={styles.tripRow}>
              <View style={styles.tripDots}>
                <MapPin size={16} color={colors.success} strokeWidth={2.4} fill={colors.success} />
              </View>
              <View style={styles.tripField}>
                <AppText variant="caption" color={colors.textSecondary}>
                  Where to?
                </AppText>
                <TextInput
                  ref={destinationRef}
                  value={destination}
                  onChangeText={(t) => {
                    setDestination(t);
                    if (destinationError) setDestinationError(null);
                  }}
                  placeholder="Select destination"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.tripInput}
                />
              </View>
              <IconButton size={40} onPress={() => destinationRef.current?.focus()}>
                <MapPin size={18} color={colors.textSecondary} strokeWidth={2.2} />
              </IconButton>
            </View>
          </View>
          {originError ? (
            <AppText variant="caption" color={colors.danger}>
              {originError}
            </AppText>
          ) : destinationError ? (
            <AppText variant="caption" color={colors.danger}>
              {destinationError}
            </AppText>
          ) : null}

          {/* Departure date & time */}
          <AppText variant="bodyStrong" style={styles.sectionTitleOnly}>
            Departure date & time
          </AppText>
          <View style={styles.dateRow}>
            <Pressable style={styles.dateBtn} onPress={openDatePicker}>
              <Calendar size={18} color={colors.primary} strokeWidth={2.2} />
              <AppText variant="body" style={styles.dateBtnText}>
                {departure.toLocaleDateString([], {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </AppText>
              <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2.2} />
            </Pressable>
            <Pressable style={styles.dateBtn} onPress={openTimePicker}>
              <Clock size={18} color={colors.primary} strokeWidth={2.2} />
              <AppText variant="body" style={styles.dateBtnText}>
                {departure.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </AppText>
              <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>
          {Platform.OS === 'ios' && showDatePicker ? (
            <DateTimePicker
              value={departure}
              mode="date"
              display="spinner"
              minimumDate={new Date()}
              onChange={(_e, date) => date && setDeparture((prev) => withDatePart(prev, date))}
            />
          ) : null}
          {Platform.OS === 'ios' && showTimePicker ? (
            <DateTimePicker
              value={departure}
              mode="time"
              display="spinner"
              onChange={(_e, time) => time && setDeparture((prev) => withTimePart(prev, time))}
            />
          ) : null}

          {/* Seats offered */}
          <AppText variant="bodyStrong" style={styles.sectionTitleOnly}>
            Seats offered
          </AppText>
          <View style={styles.stepperRow}>
            <AppText variant="body">Seats offered</AppText>
            <Stepper value={seats} onChange={setSeats} min={1} max={maxSeats} />
          </View>
          <View style={styles.capacityHint}>
            <View style={styles.capacityIcon}>
              <Armchair size={16} color={colors.primary} strokeWidth={2.2} />
            </View>
            <AppText variant="secondary" color={colors.textSecondary}>
              Total seats available in vehicle: {selectedVehicle?.seat_capacity ?? '—'}
            </AppText>
          </View>

          {/* Contribution */}
          <AppText variant="bodyStrong" style={styles.sectionTitleOnly}>
            Contribution (₹, optional)
          </AppText>
          <View style={styles.iconRow}>
            <View style={[styles.rowIcon, { backgroundColor: '#DCF5E8' }]}>
              <IndianRupee size={16} color={colors.accent.mint.fg} strokeWidth={2.2} />
            </View>
            <TextInput
              value={contribution}
              onChangeText={setContribution}
              keyboardType="number-pad"
              placeholder="e.g. fuel contribution"
              placeholderTextColor={colors.textSecondary}
              style={styles.iconRowInput}
            />
          </View>

          {/* Notes */}
          <AppText variant="bodyStrong" style={styles.sectionTitleOnly}>
            Notes (optional)
          </AppText>
          <View style={[styles.iconRow, styles.notesRow]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.chipBg }]}>
              <FileText size={16} color={colors.textSecondary} strokeWidth={2.2} />
            </View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything riders should know? (e.g. pickup point, route, preferences)"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[styles.iconRowInput, styles.notesInput]}
            />
          </View>

          {error ? (
            <AppText variant="caption" color={colors.danger}>
              {error}
            </AppText>
          ) : null}

          <Button
            label="Post ride"
            loading={create.isPending}
            onPress={handleSubmit}
            style={styles.submit}
          />
        </View>
      )}

      {/* Vehicle picker sheet — only reachable when there's more than one */}
      <Modal
        visible={vehiclePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setVehiclePickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVehiclePickerOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText variant="heading" style={styles.sheetTitle}>
            Choose vehicle
          </AppText>
          {activeVehicles.map((v: Vehicle) => {
            const active = v.id === vehicleId;
            return (
              <Pressable
                key={v.id}
                onPress={() => {
                  setVehicleId(v.id);
                  setVehicleError(false);
                  setSeats(Math.min(seats, v.seat_capacity));
                  setVehiclePickerOpen(false);
                }}
                style={[styles.sheetOption, active && styles.sheetOptionActive]}
              >
                <View style={styles.vehicleIcon}>
                  {v.vehicle_type === 'BIKE' ? (
                    <Bike size={20} color={colors.primary} strokeWidth={2.2} />
                  ) : (
                    <Car size={20} color={colors.primary} strokeWidth={2.2} />
                  )}
                </View>
                <View style={styles.vehicleText}>
                  <AppText variant="bodyStrong">
                    {v.brand} {v.model}
                  </AppText>
                  <AppText variant="secondary" color={colors.textSecondary}>
                    {v.vehicle_type_display} · {v.seat_capacity} seats
                  </AppText>
                </View>
                {active ? <Check size={20} color={colors.primary} strokeWidth={2.6} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </Screen>
  );
}

function ScreenHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton onPress={onBack} style={styles.headerBack}>
        <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
      </IconButton>
      <AppText variant="title" center>
        Post a ride
      </AppText>
      <AppText variant="body" color={colors.textSecondary} center style={styles.headerSubtitle}>
        Share your empty seats and help fellow students
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.xl },
  headerBack: { position: 'absolute', left: 0, top: 0 },
  headerSubtitle: { marginTop: spacing.xs, maxWidth: '85%' },
  noVehicle: { gap: spacing.md, marginTop: spacing.lg, alignItems: 'flex-start' },
  form: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleOnly: { marginTop: spacing.lg },
  manageLink: { flexDirection: 'row', alignItems: 'center' },
  manageChevron: { transform: [{ rotate: '-90deg' }] },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    ...shadow.subtle,
  },
  vehicleCardErrored: { borderWidth: 1, borderColor: colors.danger },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleText: { flex: 1, gap: 2 },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.subtle,
  },
  tripCardErrored: { borderWidth: 1, borderColor: colors.danger },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tripDots: { width: 16, alignItems: 'center', gap: 2 },
  dotFilled: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  dotConnector: { width: 2, height: 28, backgroundColor: colors.border },
  tripField: { flex: 1, gap: 2 },
  tripInput: { ...StyleSheet.flatten({}), color: colors.ink, padding: 0, fontSize: 15 },
  dateRow: { flexDirection: 'row', gap: spacing.md },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  dateBtnText: { flex: 1 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  capacityHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  capacityIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  notesRow: { height: undefined, minHeight: 90, alignItems: 'flex-start', paddingVertical: spacing.md },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRowInput: { flex: 1, color: colors.ink, fontSize: 15 },
  notesInput: { textAlignVertical: 'top', paddingTop: 2 },
  submit: { marginTop: spacing.sm },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    ...shadow.card,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: { marginBottom: spacing.md },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  sheetOptionActive: { backgroundColor: colors.primaryTint },
});
