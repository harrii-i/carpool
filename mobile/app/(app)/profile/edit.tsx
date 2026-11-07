import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { profileApi } from '@/api/profile';
import { AppText, Avatar, Button, Header, Screen, TextField } from '@/components';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing } from '@/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.user?.profile);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [phone, setPhone] = useState(profile?.phone_number ?? '');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      profileApi.update({
        phone_number: phone.trim(),
        profileImageUri: localImageUri ?? undefined,
      }),
    onSuccess: async () => {
      await refreshUser();
      router.back();
    },
    onError: (e) => setError(toApiError(e).message),
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Photo library permission is needed to change your picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri);
    }
  };

  // Identity fields (name, admission number, department, year) are verified
  // from the college registry and are intentionally not editable here (§9) —
  // only phone number and photo are.
  return (
    <Screen scroll>
      <Header title="Edit profile" />

      <View style={styles.avatarSection}>
        <Pressable onPress={pickImage} style={styles.avatarWrap}>
          <Avatar
            name={profile?.name}
            uri={localImageUri ?? profile?.profile_image}
            shape="circle"
            size={96}
          />
          <View style={styles.cameraBadge}>
            <Camera size={16} color={colors.white} strokeWidth={2.2} />
          </View>
        </Pressable>
        <AppText variant="caption" color={colors.textSecondary} style={styles.avatarHint}>
          Tap to change photo
        </AppText>
      </View>

      <View style={styles.form}>
        <TextField
          label="Full name"
          value={profile?.name ?? ''}
          editable={false}
          style={styles.disabledField}
        />
        <TextField
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+91…"
        />

        {error ? (
          <AppText variant="caption" color={colors.danger}>
            {error}
          </AppText>
        ) : null}

        <Button
          label="Save changes"
          loading={save.isPending}
          onPress={() => {
            setError(null);
            save.mutate();
          }}
          style={styles.submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarSection: { alignItems: 'center', marginTop: spacing.lg, gap: spacing.sm },
  avatarWrap: { position: 'relative' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarHint: { marginTop: spacing.xs },
  form: { gap: spacing.lg, marginTop: spacing.xxl },
  disabledField: { opacity: 0.6 },
  submit: { marginTop: spacing.sm },
});
