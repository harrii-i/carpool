import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * A simple, flat decorative illustration (rolling hills + tree + a car) for
 * the "Offer a ride" tile — intentionally minimal shapes, not an attempt at
 * detailed illustration art (see README's design-system notes on why).
 */
export function OfferRideIllustration({ width = 160, height = 90 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 160 90">
      {/* rolling hills */}
      <Path d="M0 70 Q 30 50 60 66 T 160 60 V90 H0 Z" fill="#CDEEDC" />
      <Path d="M0 78 Q 40 64 90 76 T 160 72 V90 H0 Z" fill="#BFE8D3" />
      {/* tree */}
      <Rect x="20" y="52" width="4" height="14" fill="#8FBFA0" rx={1} />
      <Circle cx="22" cy="46" r="10" fill="#8FBFA0" />
      {/* car body */}
      <Rect x="78" y="48" width="62" height="20" rx={8} fill={colors.accent.mint.fg} />
      <Path d="M90 48 Q98 36 112 36 Q124 36 130 48 Z" fill={colors.accent.mint.fg} />
      <Path d="M94 47 Q100 39 112 39 Q121 39 126 47 Z" fill="#E9FBF1" />
      <Circle cx="92" cy="70" r="7" fill="#1F2430" />
      <Circle cx="92" cy="70" r="3" fill="#8A93A6" />
      <Circle cx="126" cy="70" r="7" fill="#1F2430" />
      <Circle cx="126" cy="70" r="3" fill="#8A93A6" />
    </Svg>
  );
}
