import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../src/components/AppText';
import { Badge } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorView, LoadingView } from '../../src/components/StateViews';
import { useReminders } from '../../src/features/documents/hooks';
import { ReminderRow } from '../../src/features/documents/types';
import { deleteReminder, setReminderStatus } from '../../src/features/reminders/api';
import { colors, spacing } from '../../src/theme';
import { formatUkDate, isPast, relativeDayLabel } from '../../src/utils/dates';

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch, isRefetching } = useReminders();

  const refresh = () => void qc.invalidateQueries({ queryKey: ['reminders'] });

  const act = async (reminder: ReminderRow, action: 'completed' | 'dismissed' | 'pending' | 'delete') => {
    try {
      if (action === 'delete') await deleteReminder(reminder.id);
      else await setReminderStatus(reminder, action);
      refresh();
    } catch {
      Alert.alert('Something went wrong', 'The reminder could not be updated. Try again.');
    }
  };

  const pending = (data ?? []).filter((r) => r.status === 'pending');
  const done = (data ?? []).filter((r) => r.status !== 'pending');

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Reminders</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New reminder"
          onPress={() => router.push('/reminder/new')}
          hitSlop={8}
          style={styles.navButton}
        >
          <Ionicons name="add" size={26} color={colors.accent} />
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingView />
      ) : isError ? (
        <ErrorView message="Reminders could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={[...pending, ...done]}
          keyExtractor={(r) => r.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="No reminders"
              message="Create reminders from a document’s dates, or add one here."
              actionTitle="New reminder"
              onAction={() => router.push('/reminder/new')}
            />
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: spacing.md, opacity: item.status === 'pending' ? 1 : 0.55 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium">{item.title}</AppText>
                  <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                    Due {formatUkDate(item.due_date)} ({relativeDayLabel(item.due_date)?.toLowerCase()})
                  </AppText>
                  <View style={styles.badges}>
                    {item.status !== 'pending' ? (
                      <Badge label={item.status === 'completed' ? 'Completed' : 'Dismissed'} kind="neutral" />
                    ) : isPast(item.due_date) ? (
                      <Badge label="Overdue" kind="danger" icon="alert-circle-outline" />
                    ) : null}
                    {item.source === 'ai_suggested' ? <Badge label="From document" kind="info" icon="sparkles-outline" /> : null}
                  </View>
                </View>
                <View style={styles.actions}>
                  {item.status === 'pending' ? (
                    <>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${item.title} as done`} onPress={() => void act(item, 'completed')} style={styles.actionBtn}>
                        <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss ${item.title}`} onPress={() => void act(item, 'dismissed')} style={styles.actionBtn}>
                        <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
                      </Pressable>
                    </>
                  ) : (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Reactivate ${item.title}`} onPress={() => void act(item, 'pending')} style={styles.actionBtn}>
                      <Ionicons name="refresh-outline" size={22} color={colors.accent} />
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete reminder ${item.title}`}
                    onPress={() =>
                      Alert.alert('Delete reminder?', 'This removes the reminder and its notifications.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => void act(item, 'delete') },
                      ])
                    }
                    style={styles.actionBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
              {item.document_id ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open linked document"
                  onPress={() => router.push(`/document/${item.document_id}`)}
                  style={styles.docLink}
                >
                  <Ionicons name="document-text-outline" size={14} color={colors.accent} />
                  <AppText variant="captionMedium" tone="accent">
                    Open linked document
                  </AppText>
                </Pressable>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', alignItems: 'flex-start' },
  actionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  docLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, minHeight: 32 },
});
