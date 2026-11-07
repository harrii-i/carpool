import { forwardRef, ReactNode } from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: readonly Edge[];
  background?: string;
};

/**
 * Standard screen wrapper: safe area + brand background + optional scroll.
 * Forwards its ref to the inner ScrollView (when `scroll`) so a screen can
 * call `scrollTo` — e.g. to jump to the first invalid field on a long form.
 */
export const Screen = forwardRef<ScrollView, ScreenProps>(function Screen(
  {
    children,
    scroll = false,
    padded = true,
    style,
    contentStyle,
    edges = ['top', 'left', 'right'],
    background = colors.bg,
  },
  ref,
) {
  const inner = padded ? { paddingHorizontal: spacing.gutter } : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          ref={ref}
          contentContainerStyle={[styles.scrollContent, inner, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl, flexGrow: 1 },
});
