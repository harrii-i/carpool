import * as Location from 'expo-location';
import { Crosshair, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';

import { CAMPUS } from '@/lib/geo';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

export type LatLng = { latitude: number; longitude: number };

type MapPickerFieldProps = {
  label: string;
  value: LatLng | null;
  onChange: (coord: LatLng) => void;
};

/**
 * Inline map for picking a precise pickup/destination point (§12): tap or
 * drag the marker, or snap to the device's current location.
 */
export function MapPickerField({ label, value, onChange }: MapPickerFieldProps) {
  const [locating, setLocating] = useState(false);
  const region: Region = {
    latitude: value?.latitude ?? CAMPUS.latitude,
    longitude: value?.longitude ?? CAMPUS.longitude,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText variant="caption" color={colors.textSecondary}>
          {label}
        </AppText>
        <Pressable onPress={useCurrentLocation} disabled={locating} style={styles.currentBtn}>
          <Crosshair size={14} color={colors.primary} strokeWidth={2.4} />
          <AppText variant="caption" color={colors.primary}>
            {locating ? 'Locating…' : 'Use current location'}
          </AppText>
        </Pressable>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          region={region}
          onPress={(e) => onChange(e.nativeEvent.coordinate)}
        >
          {value ? (
            <Marker
              coordinate={value}
              draggable
              onDragEnd={(e) => onChange(e.nativeEvent.coordinate)}
            />
          ) : null}
        </MapView>
        {!value ? (
          <View pointerEvents="none" style={styles.hint}>
            <MapPin size={16} color={colors.textSecondary} strokeWidth={2.2} />
            <AppText variant="secondary" color={colors.textSecondary}>
              Tap the map to set this point
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  mapWrap: {
    height: 150,
    borderRadius: radius.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  map: { flex: 1 },
  hint: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
});
