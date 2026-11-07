import { Text, TextProps, TextStyle } from 'react-native';

import { colors, typography, TypographyVariant } from '@/theme';

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: string;
  center?: boolean;
};

/** The single text component — always renders in the brand type ramp. */
export function AppText({
  variant = 'body',
  color = colors.ink,
  center,
  style,
  ...rest
}: AppTextProps) {
  const base = typography[variant] as TextStyle;
  return (
    <Text
      style={[base, { color }, center && { textAlign: 'center' }, style]}
      {...rest}
    />
  );
}
