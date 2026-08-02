import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/AppText';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { TextField } from '../../../src/components/TextField';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { supabase } from '../../../src/lib/supabase';
import { colors, spacing } from '../../../src/theme';

/** Two-step, typed-confirmation account deletion. */
export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const performDelete = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
      if (error) throw error;
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch {
      Alert.alert(
        'Deletion failed',
        'Your account could not be deleted just now. Nothing has been changed — please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete everything?', 'This permanently deletes your account and every document. There is no undo.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: () => void performDelete() },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Delete account</AppText>
        <View style={styles.navButton} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Card>
          <View style={styles.warnHeader}>
            <Ionicons name="warning-outline" size={22} color={colors.danger} />
            <AppText variant="heading" tone="danger">
              This deletes everything
            </AppText>
          </View>
          <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.sm, lineHeight: 19 }}>
            Deleting your account permanently removes:
            {'\n'}• every original document file
            {'\n'}• all extracted text and details
            {'\n'}• all tags, reminders and conversations
            {'\n'}• your sign-in and household
            {'\n\n'}Deletion is immediate and cannot be undone. If you want to keep copies, download your documents
            first from each document’s screen.
          </AppText>
        </Card>

        <View style={{ marginTop: spacing.lg }}>
          <TextField
            label='Type "DELETE" to enable the button'
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            placeholder="DELETE"
          />
        </View>
        <Button
          title="Permanently delete my account"
          variant="danger"
          onPress={confirmDelete}
          disabled={confirmText.trim() !== 'DELETE'}
          loading={busy}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  warnHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
