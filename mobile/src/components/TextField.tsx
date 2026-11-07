import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import { AppText } from './AppText';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
};

/** Forwards its ref to the inner TextInput so a screen can call `.focus()`
 * — e.g. to draw attention to the first invalid field on a long form. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, style, secureTextEntry, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  // Fields that request secureTextEntry get a show/hide toggle; the visible
  // state starts hidden and the user can reveal it for a moment to check.
  const isPasswordField = !!secureTextEntry;
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="caption" color={colors.textSecondary} style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.inputWrap}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            isPasswordField && styles.inputWithIcon,
            focused && styles.focused,
            !!error && styles.errored,
            style,
          ]}
          secureTextEntry={isPasswordField && !revealed}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {isPasswordField ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            style={styles.eyeButton}
          >
            {revealed ? (
              <EyeOff size={20} color={colors.textSecondary} strokeWidth={2} />
            ) : (
              <Eye size={20} color={colors.textSecondary} strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger} style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { marginLeft: spacing.xs },
  inputWrap: { justifyContent: 'center' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 52,
    ...typography.body,
    color: colors.ink,
  },
  inputWithIcon: { paddingRight: spacing.xxxl },
  eyeButton: {
    position: 'absolute',
    right: spacing.lg,
    height: 52,
    justifyContent: 'center',
  },
  focused: { borderColor: colors.primary },
  errored: { borderColor: colors.danger },
  error: { marginLeft: spacing.xs },
});
