import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { useState } from 'react';
import { Alert, Linking } from 'react-native';

import { toApiError } from '@/api/client';
import { sosApi } from '@/api/safety';
import type { SOSActions } from '@/api/types';

/**
 * Triggers SOS (§28): captures the device's current location, calls the
 * backend (which creates the immutable event and decides what to do per the
 * student's SOSConfig), then carries out the returned actions *natively* —
 * the backend never places calls or sends SMS itself (§29).
 */
export function useSosTrigger() {
  const [triggering, setTriggering] = useState(false);

  async function trigger(rideId?: string) {
    setTriggering(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        }
      } catch {
        // Proceed without a location fix rather than blocking the SOS.
      }

      const { actions } = await sosApi.trigger({ ride_id: rideId, latitude, longitude });
      await runActions(actions);
    } catch (err) {
      Alert.alert('Could not trigger SOS', toApiError(err).message);
    } finally {
      setTriggering(false);
    }
  }

  return { trigger, triggering };
}

async function runActions(actions: SOSActions) {
  const steps: string[] = [];
  if (actions.call) steps.push(`Call ${actions.call.name}`);
  if (actions.message && actions.recipients.length > 0) {
    steps.push(`Message ${actions.recipients.length} contact(s)`);
  }
  if (actions.tracking_link) steps.push('Live location shared');

  Alert.alert(
    'SOS triggered',
    steps.length > 0
      ? `Taking action:\n\n${steps.join('\n')}`
      : 'No emergency contacts are configured yet — add one in SOS settings.',
    [
      {
        text: 'OK',
        onPress: () => {
          if (actions.call) {
            void Linking.openURL(`tel:${actions.call.phone_number}`);
          }
          if (actions.message && actions.recipients.length > 0) {
            void sendEmergencySms(actions.message, actions.recipients.map((r) => r.phone_number));
          }
        },
      },
    ],
  );
}

async function sendEmergencySms(message: string, numbers: string[]) {
  const available = await SMS.isAvailableAsync();
  if (!available) return;
  await SMS.sendSMSAsync(numbers, message);
}
