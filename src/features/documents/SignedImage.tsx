import { Image, ImageStyle } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';
import { AppText } from '../../components/AppText';
import { getSignedUrl } from './api';

/**
 * Renders a storage object via a short-lived signed URL. The URL is fetched
 * with the user's JWT, so storage policies gate access; it is refreshed
 * before expiry by React Query staleTime.
 */
export function SignedImage({
  storagePath,
  style,
  accessibilityLabel,
}: {
  storagePath: string;
  style?: ViewStyle & ImageStyle;
  accessibilityLabel?: string;
}) {
  const { data: url, isLoading, isError } = useQuery({
    queryKey: ['signed-url', storagePath],
    queryFn: () => getSignedUrl(storagePath),
    staleTime: 240_000, // refresh before the 300 s URL expires
    retry: 1,
  });

  if (isLoading) {
    return (
      <View style={[styles.placeholder, style]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (isError || !url) {
    return (
      <View style={[styles.placeholder, style]}>
        <AppText variant="caption" tone="muted">
          Preview unavailable
        </AppText>
      </View>
    );
  }
  return <Image source={{ uri: url }} style={[styles.image, style]} contentFit="contain" accessibilityLabel={accessibilityLabel} />;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  image: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
});
