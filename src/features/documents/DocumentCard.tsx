import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { categoryLabel } from '../../config/categories';
import { colors, spacing } from '../../theme';
import { formatUkDateShort, isPast, isWithinDays, relativeDayLabel } from '../../utils/dates';
import { STATUS_META } from './statusMeta';
import { DocumentRow } from './types';

/** The soonest upcoming (or most recently missed) key date on a document. */
export function keyDate(doc: DocumentRow): { label: string; iso: string } | null {
  const candidates: { label: string; iso: string | null }[] = [
    { label: 'Deadline', iso: doc.deadline_date },
    { label: 'Renewal', iso: doc.renewal_date },
    { label: 'Expires', iso: doc.expiry_date },
  ];
  const present = candidates.filter((c): c is { label: string; iso: string } => !!c.iso);
  if (present.length === 0) return null;
  present.sort((a, b) => a.iso.localeCompare(b.iso));
  const upcoming = present.find((c) => !isPast(c.iso));
  return upcoming ?? present[present.length - 1];
}

export function DocumentCard({ doc, personName }: { doc: DocumentRow; personName?: string | null }) {
  const status = STATUS_META[doc.status];
  const date = keyDate(doc);
  const showStatus = doc.status !== 'ready';
  return (
    <Card
      onPress={() => router.push(`/document/${doc.id}`)}
      accessibilityLabel={`${doc.title}, ${categoryLabel(doc.category)}${doc.provider ? `, ${doc.provider}` : ''}`}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          <AppText variant="bodyMedium" numberOfLines={2}>
            {doc.title}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={{ marginTop: 2 }}>
            {[doc.provider, categoryLabel(doc.category), personName].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <AppText variant="caption" tone="muted">
          {formatUkDateShort(doc.document_date ?? doc.created_at.slice(0, 10))}
        </AppText>
      </View>
      {(showStatus || doc.action_required || date) && (
        <View style={styles.badges}>
          {showStatus ? <Badge label={status.label} kind={status.kind} icon={status.icon} /> : null}
          {doc.action_required ? <Badge label="Action needed" kind="warning" icon="flag-outline" /> : null}
          {date ? (
            <Badge
              label={`${date.label} ${relativeDayLabel(date.iso)?.toLowerCase() ?? formatUkDateShort(date.iso)}`}
              kind={isPast(date.iso) ? 'danger' : isWithinDays(date.iso, 30) ? 'warning' : 'neutral'}
              icon="calendar-outline"
            />
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  titleWrap: { flex: 1 },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
