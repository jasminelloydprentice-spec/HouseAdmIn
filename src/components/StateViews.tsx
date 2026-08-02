import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export function LoadingView({ message }: { message?: string }) {
  return (
    <View style={styles.center} accessibilityLabel={message ?? 'Loading'}>
      <ActivityIndicator size="large" color={colors.accent} />
      {message ? (
        <AppText tone="secondary" style={{ marginTop: spacing.lg }}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <AppText variant="heading" align="center">
        Something went wrong
      </AppText>
      <AppText tone="secondary" align="center" style={{ marginTop: spacing.sm }}>
        {message}
      </AppText>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="secondary" style={{ marginTop: spacing.xl }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
});
