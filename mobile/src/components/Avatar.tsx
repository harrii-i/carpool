import { Image } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';
import { AppText } from './AppText';

type AvatarProps = {
  name?: string;
  uri?: string | null;
  size?: number;
  /** 'square' (default, our usual icon-tile language) or 'circle'. */
  shape?: 'square' | 'circle';
};

/** Rounded-square (or circular) avatar; falls back to initials on a tinted tile. */
export function Avatar({ name, uri, size = 48, shape = 'square' }: AvatarProps) {
  const dimension = {
    width: size,
    height: size,
    borderRadius: shape === 'circle' ? size / 2 : radius.md,
  };
  if (uri) {
    return <Image source={{ uri }} style={dimension} />;
  }
  return (
    <View style={[styles.fallback, dimension]}>
      <AppText variant="cardTitle" color={colors.primary}>
        {initials(name)}
      </AppText>
    </View>
  );
}

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '').concat(parts[1]?.[0] ?? '').toUpperCase() || '?';
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
