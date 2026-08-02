import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../../src/components/AppText';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { EmptyState } from '../../../src/components/EmptyState';
import { Screen } from '../../../src/components/Screen';
import { CATEGORIES } from '../../../src/config/categories';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { DocumentCard, keyDate } from '../../../src/features/documents/DocumentCard';
import { useDocuments, useReminders } from '../../../src/features/documents/hooks';
import { colors, radius, spacing } from '../../../src/theme';
import { formatUkDateShort, isPast, isWithinDays, relativeDayLabel } from '../../../src/utils/dates';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { session } = useAuth();
  const { data: documents, isLoading, refetch, isRefetching } = useDocuments({ sort: 'newest' });
  const { data: reminders } = useReminders();

  const name = session?.user.email?.split('@')[0] ?? '';

  const actionNeeded = useMemo(() => (documents ?? []).filter((d) => d.action_required).slice(0, 3), [documents]);
  const expiringSoon = useMemo(
    () =>
      (documents ?? [])
        .map((d) => ({ doc: d, date: keyDate(d) }))
        .filter((x): x is { doc: (typeof documents & object)[number]; date: { label: string; iso: string } } => !!x.date && !isPast(x.date.iso) && isWithinDays(x.date.iso, 60))
        .sort((a, b) => a.date.iso.localeCompare(b.date.iso))
        .slice(0, 3),
    [documents],
  );
  const pendingReminders = useMemo(
    () => (reminders ?? []).filter((r) => r.status === 'pending' && !isPast(r.due_date)).slice(0, 3),
    [reminders],
  );
  const recent = (documents ?? []).slice(0, 3);
  const isEmpty = !isLoading && (documents ?? []).length === 0;

  return (
    <Screen refreshing={isRefetching} onRefresh={() => void refetch()}>
      <View style={styles.header}>
        <AppText variant="largeTitle">{greeting()}{name ? `, ${name}` : ''}</AppText>
        <AppText tone="secondary" style={{ marginTop: spacing.xs }}>
          Your paperwork, safe and searchable.
        </AppText>
      </View>

      <Button title="Scan paperwork" icon="camera-outline" onPress={() => router.push('/(app)/(tabs)/scan')} />

      {isEmpty ? (
        <EmptyState
          icon="leaf-outline"
          title="Start with one letter"
          message="Photograph a recent letter or import a PDF. It stays private to your household, and you can ask for its details any time."
        />
      ) : (
        <>
          {actionNeeded.length > 0 ? (
            <Section title="Action needed" onSeeAll={() => router.push('/(app)/(tabs)/documents')}>
              {actionNeeded.map((d) => (
                <DocumentCard key={d.id} doc={d} />
              ))}
            </Section>
          ) : null}

          {expiringSoon.length > 0 ? (
            <Section title="Expiring soon" onSeeAll={() => router.push('/(app)/(tabs)/documents')}>
              {expiringSoon.map(({ doc, date }) => (
                <Card key={doc.id} onPress={() => router.push(`/document/${doc.id}`)} accessibilityLabel={`${doc.title}, ${date.label} ${formatUkDateShort(date.iso)}`} style={{ marginBottom: spacing.md }}>
                  <View style={styles.expiringRow}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyMedium" numberOfLines={1}>
                        {doc.title}
                      </AppText>
                      <AppText variant="caption" tone="secondary">
                        {date.label} · {formatUkDateShort(date.iso)} ({relativeDayLabel(date.iso)?.toLowerCase()})
                      </AppText>
                    </View>
                    <Ionicons name="hourglass-outline" size={20} color={colors.warning} />
                  </View>
                </Card>
              ))}
            </Section>
          ) : null}

          {pendingReminders.length > 0 ? (
            <Section title="Reminders" onSeeAll={() => router.push('/reminders')}>
              {pendingReminders.map((r) => (
                <Card key={r.id} onPress={() => router.push('/reminders')} accessibilityLabel={`Reminder: ${r.title}, due ${formatUkDateShort(r.due_date)}`} style={{ marginBottom: spacing.md }}>
                  <View style={styles.expiringRow}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyMedium" numberOfLines={1}>
                        {r.title}
                      </AppText>
                      <AppText variant="caption" tone="secondary">
                        Due {formatUkDateShort(r.due_date)} ({relativeDayLabel(r.due_date)?.toLowerCase()})
                      </AppText>
                    </View>
                    <Ionicons name="notifications-outline" size={20} color={colors.accent} />
                  </View>
                </Card>
              ))}
            </Section>
          ) : null}

          {recent.length > 0 ? (
            <Section title="Recently added" onSeeAll={() => router.push('/(app)/(tabs)/documents')}>
              {recent.map((d) => (
                <DocumentCard key={d.id} doc={d} />
              ))}
            </Section>
          ) : null}
        </>
      )}

      <Section title="Browse by category">
        <View style={styles.categoryGrid}>
          {CATEGORIES.slice(0, 8).map((c) => (
            <Pressable
              key={c.slug}
              accessibilityRole="button"
              accessibilityLabel={`Browse ${c.label}`}
              onPress={() => router.push('/(app)/(tabs)/documents')}
              style={styles.categoryTile}
            >
              <Ionicons name={c.icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.accent} />
              <AppText variant="caption" align="center" style={{ marginTop: spacing.xs }}>
                {c.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

function Section({ title, children, onSeeAll }: { title: string; children: React.ReactNode; onSeeAll?: () => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="heading">{title}</AppText>
        {onSeeAll ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`See all: ${title}`} onPress={onSeeAll} hitSlop={8}>
            <AppText variant="captionMedium" tone="accent">
              See all
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.xl },
  section: { marginTop: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, minHeight: 32 },
  expiringRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  categoryTile: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
