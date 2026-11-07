import { api } from './client';
import { StudentProfile } from './types';

export type ProfileUpdatePayload = {
  phone_number?: string;
  /** A local file URI (from expo-image-picker) to upload as the new photo. */
  profileImageUri?: string;
};

export const profileApi = {
  async get(): Promise<StudentProfile> {
    const { data } = await api.get<StudentProfile>('/profile/');
    return data;
  },

  async update(payload: ProfileUpdatePayload): Promise<StudentProfile> {
    const form = new FormData();
    if (payload.phone_number !== undefined) {
      form.append('phone_number', payload.phone_number);
    }
    if (payload.profileImageUri) {
      const filename = payload.profileImageUri.split('/').pop() || 'avatar.jpg';
      const ext = filename.split('.').pop()?.toLowerCase();
      const type = ext === 'png' ? 'image/png' : 'image/jpeg';
      // React Native's fetch/FormData accepts this {uri,name,type} shape for
      // file fields; axios forwards it through unchanged over multipart.
      form.append('profile_image', {
        uri: payload.profileImageUri,
        name: filename,
        type,
      } as unknown as Blob);
    }
    const { data } = await api.patch<StudentProfile>('/profile/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
