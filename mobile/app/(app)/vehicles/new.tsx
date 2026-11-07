import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { vehiclesApi } from '@/api/vehicles';
import type { VehicleType } from '@/api/types';
import {
  AppText,
  Button,
  Header,
  Screen,
  SegmentedControl,
  Stepper,
  TextField,
} from '@/components';
import { colors, spacing } from '@/theme';

export default function NewVehicleScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const [type, setType] = useState<VehicleType>('CAR');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [registration, setRegistration] = useState('');
  const [color, setColor] = useState('');
  const [seats, setSeats] = useState(4);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      vehiclesApi.create({
        vehicle_type: type,
        brand: brand.trim(),
        model: model.trim(),
        registration_number: registration.trim(),
        color: color.trim(),
        seat_capacity: seats,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      router.back();
    },
    onError: (e) => setError(toApiError(e).message),
  });

  const canSubmit =
    brand.trim() && model.trim() && registration.trim() && color.trim();

  return (
    <Screen scroll>
      <Header title="Add vehicle" />
      <View style={styles.form}>
        <View style={styles.field}>
          <AppText variant="caption" color={colors.textSecondary}>
            Type
          </AppText>
          <SegmentedControl
            value={type}
            onChange={(t) => {
              setType(t);
              setSeats(t === 'BIKE' ? 1 : 4);
            }}
            options={[
              { value: 'CAR', label: 'Car' },
              { value: 'BIKE', label: 'Bike' },
            ]}
          />
        </View>

        <TextField label="Brand" value={brand} onChangeText={setBrand} placeholder="e.g. Toyota" />
        <TextField label="Model" value={model} onChangeText={setModel} placeholder="e.g. Etios" />
        <TextField
          label="Registration number"
          value={registration}
          onChangeText={setRegistration}
          autoCapitalize="characters"
          placeholder="e.g. KL01AB1234"
        />
        <TextField label="Colour" value={color} onChangeText={setColor} placeholder="e.g. White" />

        <View style={styles.stepperRow}>
          <AppText variant="body">Seat capacity</AppText>
          <Stepper value={seats} onChange={setSeats} min={1} max={8} />
        </View>

        {error ? (
          <AppText variant="caption" color={colors.danger}>
            {error}
          </AppText>
        ) : null}

        <Button
          label="Save vehicle"
          loading={create.isPending}
          disabled={!canSubmit}
          onPress={() => {
            setError(null);
            create.mutate();
          }}
          style={styles.submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  field: { gap: spacing.xs },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  submit: { marginTop: spacing.sm },
});
