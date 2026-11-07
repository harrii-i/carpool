/**
 * Design tokens derived from the reference screenshot — the single visual
 * source of truth for the whole app. Every screen consumes these; do not
 * hard-code colours, spacing, or radii elsewhere.
 *
 * v2 (current): vivid royal-blue accent on a soft blue-lavender → white
 * backdrop, pastel accent tiles for quick actions, flat bottom tab bar with
 * a pill highlight behind the active icon.
 */

export const colors = {
  primary: '#3D5AFE', // vivid royal blue — primary buttons, active tab, links
  primaryPressed: '#2F46D9',
  primaryTint: '#E4E9FE', // pale blue — active tab pill, icon tiles, avatar bg

  ink: '#14152B', // near-black with a blue cast — headings, prices
  textSecondary: '#7B8498', // muted labels/subtitles

  bg: '#F7F9FE', // app screen background (soft blue-white)
  bgGradientTop: '#E7EDFC', // top of the Home hero gradient
  surface: '#FFFFFF', // cards, sheets, icon buttons
  chipBg: '#F0F2FA', // inactive chips
  border: '#E9ECF5', // hairline borders

  success: '#2FB873',
  danger: '#F14C62', // SOS / destructive / map pin
  star: '#F0A82E',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(20, 21, 43, 0.45)',

  // Soft pastel accent tiles (quick links, feature cards): each pairs a tint
  // background with a stronger foreground for its icon.
  accent: {
    mint: { bg: '#DCF5E8', fg: '#1FA862' }, // Post a ride
    lavender: { bg: '#E6E3FB', fg: '#5B4FD9' }, // My rides
    amber: { bg: '#FBEFD9', fg: '#D99A2B' }, // Saved rides
    rose: { bg: '#FBE1E6', fg: '#DB5774' }, // Nearby riders
    sky: { bg: '#DCEBFB', fg: '#2E7FD1' }, // Recent trips
    slate: { bg: '#E9EBF1', fg: '#5C6478' }, // Settings
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  gutter: 20, // standard screen side padding
} as const;

export const radius = {
  sm: 14,
  md: 16, // icon tiles / small buttons
  button: 18,
  card: 26,
  sheet: 28,
  pill: 999,
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Type ramp: [fontSize, lineHeight, fontFamily]. */
export const typography = {
  hero: { fontSize: 30, lineHeight: 36, fontFamily: fonts.extrabold }, // Home headline
  display: { fontSize: 28, lineHeight: 34, fontFamily: fonts.extrabold }, // prices
  title: { fontSize: 20, lineHeight: 26, fontFamily: fonts.bold }, // screen titles
  heading: { fontSize: 18, lineHeight: 24, fontFamily: fonts.bold },
  cardTitle: { fontSize: 16, lineHeight: 22, fontFamily: fonts.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.medium },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: fonts.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fonts.medium },
  secondary: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
} as const;

/** Single soft, diffuse shadow used across cards and floating elements. */
export const shadow = {
  card: {
    shadowColor: '#141B3C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
    elevation: 3,
  },
  subtle: {
    shadowColor: '#141B3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
} as const;

export type ThemeColor = keyof typeof colors;
export type TypographyVariant = keyof typeof typography;
export type AccentTone = keyof typeof colors.accent;
