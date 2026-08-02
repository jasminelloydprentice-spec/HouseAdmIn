import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../../src/components/AppText';
import { Card } from '../../../src/components/Card';
import { Screen } from '../../../src/components/Screen';
import { brand } from '../../../src/config/brand';
import { env } from '../../../src/config/env';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { colors, spacing, touchTarget } from '../../../src/theme';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="largeTitle">Settings</AppText>
      </View>

      <Card>
        <AppText variant="caption" tone="secondary">
          Signed in as
        </AppText>
        <AppText variant="bodyMedium" style={{ marginTop: 2 }}>
          {session?.user.email ?? '—'}
        </AppText>
      </Card>

      <Card style={styles.group}>
        <SettingsRow icon="people-outline" label="Household people" onPress={() => router.push('/settings/people')} />
        <SettingsRow icon="notifications-outline" label="Reminders" onPress={() => router.push('/reminders')} />
        <SettingsRow icon="shield-checkmark-outline" label="Privacy and data" onPress={() => router.push('/settings/privacy')} />
        {env.devToolsEnabled ? (
          <SettingsRow icon="construct-outline" label="Developer" onPress={() => router.push('/settings/developer')} last />
        ) : null}
      </Card>

      <Card style={styles.group}>
        <SettingsRow
          icon="log-out-outline"
          label="Sign out"
          onPress={() =>
            Alert.alert('Sign out?', 'Your documents stay safely stored — sign back in any time.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', onPress: () => void signOut() },
            ])
          }
        />
        <SettingsRow icon="trash-outline" label="Delete account and data" destructive onPress={() => router.push('/settings/delete-account')} last />
      </Card>

      <AppText variant="caption" tone="muted" align="center" style={{ marginTop: spacing.xl }}>
        {brand.name} · {brand.description}
      </AppText>
    </Screen>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  destructive,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.row, !last && styles.rowDivider]}
    >
      <Ionicons name={icon} size={20} color={destructive ? colors.danger : colors.textSecondary} />
      <AppText variant="body" tone={destructive ? 'danger' : 'primary'} style={{ flex: 1 }}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.xl },
  group: { marginTop: spacing.lg, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget + 8 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
