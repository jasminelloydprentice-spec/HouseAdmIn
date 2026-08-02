import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/AppText';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { TextField } from '../../../src/components/TextField';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { createReminder } from '../../../src/features/reminders/api';
import { DEFAULT_LEAD_DAYS, leadLabel } from '../../../src/features/reminders/offsets';
import { colors, radius, spacing } from '../../../src/theme';
import { formatUkDate, isPast, parseUkDateInput } from '../../../src/utils/dates';

/**
 * Create a reminder. When arriving from a document, the AI-detected date is
 * pre-filled but nothing is scheduled until the user explicitly confirms —
 * uncertain AI dates never become notifications on their own.
 */
export default function NewReminderScreen() {
  const params = useLocalSearchParams<{ documentId?: string; title?: string; dueDate?: string }>();
  const insets = useSafeAreaInsets();
  const { householdId } = useAuth();
  const qc = useQueryClient();

  const fromDocument = !!params.documentId;
  const [title, setTitle] = useState(params.title ? `Act on: ${params.title}` : '');
  const [dueDateInput, setDueDateInput] = useState(params.dueDate ? formatUkDate(params.dueDate) : '');
  const [leads, setLeads] = useState<number[]>([...DEFAULT_LEAD_DAYS]);
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});
  const [saving, setSaving] = useState(false);

  const toggleLead = (lead: number) => {
    setLeads((prev) => (prev.includes(lead) ? prev.filter((l) => l !== lead) : [...prev, lead]));
  };

  const save = async () => {
    const nextErrors: { title?: string; date?: string } = {};
    if (!title.trim()) nextErrors.title = 'Give the reminder a short title.';
    const iso = parseUkDateInput(dueDateInput);
    if (!iso) nextErrors.date = 'Use a date like 14/06/2026 or 14 June 2026.';
    else if (isPast(iso)) nextErrors.date = 'That date is in the past.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !iso || !householdId) return;

    setSaving(true);
    try {
      await createReminder({
        householdId,
        documentId: params.documentId ?? null,
        title: title.trim(),
        dueDate: iso,
        leadDays: leads,
        source: fromDocument ? 'ai_suggested' : 'user',
      });
      void qc.invalidateQueries({ queryKey: ['reminders'] });
      router.replace('/reminders');
    } catch {
      Alert.alert('Could not save', 'The reminder could not be created. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="heading">New reminder</AppText>
        <View style={styles.navButton} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        {fromDocument ? (
          <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
            <AppText variant="caption" tone="secondary">
              This date was read from your document. Please check it before confirming — nothing is scheduled until you
              save.
            </AppText>
          </Card>
        ) : null}

        <TextField label="Reminder" value={title} onChangeText={setTitle} placeholder="e.g. Renew home insurance" error={errors.title} />
        <TextField
          label="Due date"
          value={dueDateInput}
          onChangeText={setDueDateInput}
          placeholder="14/06/2026"
          error={errors.date}
          hint="UK format — day first."
        />

        <AppText variant="captionMedium" tone="secondary" style={{ marginBottom: spacing.sm }}>
          Remind me
        </AppText>
        <View style={styles.leadWrap}>
          {DEFAULT_LEAD_DAYS.map((lead) => (
            <Pressable
              key={lead}
              accessibilityRole="button"
              accessibilityState={{ selected: leads.includes(lead) }}
              accessibilityLabel={leadLabel(lead)}
              onPress={() => toggleLead(lead)}
              style={[styles.leadChip, leads.includes(lead) && styles.leadChipActive]}
            >
              <AppText variant="captionMedium" style={{ color: leads.includes(lead) ? colors.onAccent : colors.textSecondary }}>
                {leadLabel(lead)}
              </AppText>
            </Pressable>
          ))}
        </View>
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
          You’ll also get a notification on the day. Notifications are local to this device and need permission the
          first time.
        </AppText>

        <Button title="Save reminder" onPress={() => void save()} loading={saving} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  leadWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  leadChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
  },
  leadChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
});
