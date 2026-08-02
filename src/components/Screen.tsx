import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export interface ScreenProps {
  children: ReactNode;
  /** Scrollable content (default true). Set false for lists that scroll themselves. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Extra bottom padding, e.g. above the tab bar. */
  padded?: boolean;
  style?: ViewStyle;
}

/** Standard screen container: warm background, safe-area aware, keyboard-safe. */
export function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = padded ? { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl } : undefined;

  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[padding, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding, style]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top > 0 ? 0 : spacing.md }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
