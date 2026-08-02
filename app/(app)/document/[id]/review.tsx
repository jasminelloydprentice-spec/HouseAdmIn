import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../../src/components/AppText';
import { Badge } from '../../../../src/components/Badge';
import { Button } from '../../../../src/components/Button';
import { Card } from '../../../../src/components/Card';
import { ErrorView, LoadingView } from '../../../../src/components/StateViews';
import { TextField } from '../../../../src/components/TextField';
import { CATEGORIES } from '../../../../src/config/categories';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { ensureTags, setDocumentTags, updateDocument, updateField } from '../../../../src/features/documents/api';
import { fieldDisplayValue, isLowConfidence, provenanceLabel, sortFields } from '../../../../src/features/documents/fieldPresentation';
import { useDocumentDetail, usePeople } from '../../../../src/features/documents/hooks';
import { SignedImage } from '../../../../src/features/documents/SignedImage';
import { DocumentFieldRow } from '../../../../src/features/documents/types';
import { supabase } from '../../../../src/lib/supabase';
import { colors, radius, spacing } from '../../../../src/theme';
import { formatUkDate, parseUkDateInput } from '../../../../src/utils/dates';

interface FieldEdit {
  /** Raw text as typed; parsed on save according to the field's kind. */
  raw: string;
  error: string | null;
}

/**
 * Review-before-save. Everything the AI produced is editable; edited fields
 * are re-labelled `user_corrected`, untouched AI fields stay `ai`. Saving
 * promotes the document to `ready` even when extraction was incomplete.
 */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: doc, isLoading, isError, refetch } = useDocumentDetail(id);

  if (isLoading) return <LoadingView message="Loading extraction…" />;
  if (isError || !doc) return <ErrorView message="The document could not be loaded." onRetry={() => void refetch()} />;

  // Keying by document id gives the form fresh initial state per document
  // without effect-driven state syncing.
  return <ReviewForm key={doc.id} doc={doc} />;
}

function ReviewForm({ doc }: { doc: NonNullable<ReturnType<typeof useDocumentDetail>['data']> }) {
  const insets = useSafeAreaInsets();
  const { householdId } = useAuth();
  const qc = useQueryClient();
  const { data: people } = usePeople();

  const [title, setTitle] = useState(doc.title);
  const [provider, setProvider] = useState(doc.provider ?? '');
  const [docType, setDocType] = useState(doc.doc_type ?? '');
  const [category, setCategory] = useState<string>(doc.category);
  const [personId, setPersonId] = useState<string | null>(doc.person_id);
  const [sensitive, setSensitive] = useState(doc.is_sensitive);
  const [deadline, setDeadline] = useState(doc.deadline_date ? formatUkDate(doc.deadline_date) : '');
  const [renewal, setRenewal] = useState(doc.renewal_date ? formatUkDate(doc.renewal_date) : '');
  const [expiry, setExpiry] = useState(doc.expiry_date ? formatUkDate(doc.expiry_date) : '');
  const [dateErrors, setDateErrors] = useState<{ deadline?: string; renewal?: string; expiry?: string }>({});
  const [tags, setTags] = useState<string[]>(
    doc.document_tags.map((t) => t.tags?.name).filter((n): n is string => !!n),
  );
  const [tagInput, setTagInput] = useState('');
  const [fieldEdits, setFieldEdits] = useState<Record<string, FieldEdit>>({});
  const [saving, setSaving] = useState(false);
  const qcInvalidate = () => {
    void qc.invalidateQueries({ queryKey: ['document', doc.id] });
    void qc.invalidateQueries({ queryKey: ['documents'] });
  };

  const fields = sortFields(doc.document_fields);
  const firstPage = doc.document_files.find((f) => f.kind === 'original' && f.mime_type.startsWith('image/'));

  const parseDateInput = (label: 'deadline' | 'renewal' | 'expiry', value: string): string | null | 'error' => {
    if (!value.trim()) return null;
    const iso = parseUkDateInput(value);
    if (!iso) {
      setDateErrors((e) => ({ ...e, [label]: 'Use a date like 14/06/2026 or 14 June 2026' }));
      return 'error';
    }
    return iso;
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Title needed', 'Give the document a short title so you can find it later.');
      return;
    }
    setDateErrors({});
    const deadlineIso = parseDateInput('deadline', deadline);
    const renewalIso = parseDateInput('renewal', renewal);
    const expiryIso = parseDateInput('expiry', expiry);
    if (deadlineIso === 'error' || renewalIso === 'error' || expiryIso === 'error') return;

    setSaving(true);
    try {
      // 1. Field corrections → user_corrected provenance.
      for (const field of fields) {
        const edit = fieldEdits[field.id];
        if (!edit || edit.raw === fieldDisplayValue(field)) continue;
        const raw = edit.raw.trim();
        if (field.value_date !== null || field.key.includes('date')) {
          const iso = raw ? parseUkDateInput(raw) : null;
          if (raw && !iso) {
            setFieldEdits((e) => ({ ...e, [field.id]: { raw: edit.raw, error: 'Use a date like 14/06/2026' } }));
            setSaving(false);
            return;
          }
          await updateField(field.id, { value_date: iso, source: 'user_corrected' });
        } else if (field.value_number !== null) {
          const num = raw ? Number(raw.replace(/[£,\s]/g, '')) : null;
          if (raw && (num === null || Number.isNaN(num))) {
            setFieldEdits((e) => ({ ...e, [field.id]: { raw: edit.raw, error: 'Enter a plain number like 48210.55' } }));
            setSaving(false);
            return;
          }
          await updateField(field.id, { value_number: num, source: 'user_corrected' });
        } else {
          await updateField(field.id, { value_text: raw || null, source: 'user_corrected' });
        }
      }

      // 2. Document-level updates; saving completes review.
      await updateDocument(doc.id, {
        title: title.trim(),
        category,
        provider: provider.trim() || null,
        doc_type: docType.trim() || null,
        person_id: personId,
        is_sensitive: sensitive,
        deadline_date: deadlineIso,
        renewal_date: renewalIso,
        expiry_date: expiryIso,
        status: 'ready',
      });

      // 3. Tags.
      if (householdId) {
        const tagRows = await ensureTags(householdId, tags);
        await setDocumentTags(doc.id, householdId, tagRows.map((t) => t.id));
      }

      await supabase.from('audit_events').insert({
        household_id: doc.household_id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        event_type: 'document_reviewed',
        entity: 'documents',
        entity_id: doc.id,
      });

      qcInvalidate();
      router.replace(`/document/${doc.id}`);
    } catch {
      Alert.alert('Save failed', 'Your changes could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back without saving" onPress={() => router.back()} hitSlop={8} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Review details</AppText>
        <View style={styles.navButton} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        {doc.status === 'needs_review' ? (
          <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
            <AppText variant="caption" tone="secondary">
              These details were read automatically from your document. Check them — especially numbers and dates — then save.
              Fields marked “AI extracted” have not been confirmed by you yet.
            </AppText>
          </Card>
        ) : null}

        {firstPage ? <SignedImage storagePath={firstPage.storage_path} style={styles.preview} accessibilityLabel="First page preview" /> : null}

        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Aviva annual pension statement" />
        <TextField label="Organisation / provider" value={provider} onChangeText={setProvider} placeholder="e.g. Aviva" />
        <TextField label="Document type" value={docType} onChangeText={setDocType} placeholder="e.g. Annual statement" />

        <AppText variant="captionMedium" tone="secondary" style={styles.groupLabel}>
          Category
        </AppText>
        <View style={styles.chipWrap}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.slug}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c.slug }}
              accessibilityLabel={c.label}
              onPress={() => setCategory(c.slug)}
              style={[styles.chip, category === c.slug && styles.chipActive]}
            >
              <AppText variant="captionMedium" style={{ color: category === c.slug ? colors.onAccent : colors.textSecondary }}>
                {c.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="captionMedium" tone="secondary" style={styles.groupLabel}>
          Belongs to
        </AppText>
        <View style={styles.chipWrap}>
          {(people ?? []).map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={{ selected: personId === p.id }}
              accessibilityLabel={`Assign to ${p.name}`}
              onPress={() => setPersonId(personId === p.id ? null : p.id)}
              style={[styles.chip, personId === p.id && styles.chipActive]}
            >
              <AppText variant="captionMedium" style={{ color: personId === p.id ? colors.onAccent : colors.textSecondary }}>
                {p.name}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Key dates — user confirms or corrects AI-detected dates */}
        <AppText variant="heading" style={styles.sectionTitle}>
          Key dates
        </AppText>
        <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
          Only save dates you’ve checked against the document. Leave blank if not relevant.
        </AppText>
        <TextField label="Deadline (act by)" value={deadline} onChangeText={setDeadline} placeholder="14/06/2026" error={dateErrors.deadline} />
        <TextField label="Renewal date" value={renewal} onChangeText={setRenewal} placeholder="14/06/2026" error={dateErrors.renewal} />
        <TextField label="Expiry date" value={expiry} onChangeText={setExpiry} placeholder="14/06/2026" error={dateErrors.expiry} />

        {/* Extracted fields */}
        {fields.length > 0 ? (
          <>
            <AppText variant="heading" style={styles.sectionTitle}>
              Extracted details
            </AppText>
            {fields.map((field) => (
              <FieldEditor
                key={field.id}
                field={field}
                edit={fieldEdits[field.id]}
                onChange={(raw) => setFieldEdits((e) => ({ ...e, [field.id]: { raw, error: null } }))}
              />
            ))}
          </>
        ) : (
          <Card style={{ marginTop: spacing.lg }}>
            <AppText variant="caption" tone="secondary">
              No structured details were extracted{doc.status === 'failed' ? ' because analysis failed' : ''}. You can still
              save the document — it stays searchable by title, and you can retry analysis from the document screen.
            </AppText>
          </Card>
        )}

        {/* Tags */}
        <AppText variant="heading" style={styles.sectionTitle}>
          Tags
        </AppText>
        <View style={styles.chipWrap}>
          {tags.map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${t}`}
              onPress={() => setTags((prev) => prev.filter((x) => x !== t))}
              style={[styles.chip, styles.tagChip]}
            >
              <AppText variant="captionMedium" tone="accent">
                {t}
              </AppText>
              <Ionicons name="close" size={12} color={colors.accent} />
            </Pressable>
          ))}
        </View>
        <TextField
          label="Add a tag"
          value={tagInput}
          onChangeText={setTagInput}
          placeholder="e.g. boiler"
          autoCapitalize="none"
          onSubmitEditing={() => {
            const t = tagInput.trim().toLowerCase();
            if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
            setTagInput('');
          }}
          returnKeyType="done"
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyMedium">Especially sensitive</AppText>
            <AppText variant="caption" tone="muted">
              Marks this document as containing particularly private information.
            </AppText>
          </View>
          <Switch
            value={sensitive}
            onValueChange={setSensitive}
            trackColor={{ true: colors.accent, false: colors.border }}
            accessibilityLabel="Mark as especially sensitive"
          />
        </View>

        <Button title="Save document" onPress={() => void save()} loading={saving} style={{ marginTop: spacing.xl }} />
        <AppText variant="caption" tone="muted" align="center" style={{ marginTop: spacing.md }}>
          You can save even if some details are missing — everything stays editable later.
        </AppText>
      </ScrollView>
    </View>
  );
}

function FieldEditor({
  field,
  edit,
  onChange,
}: {
  field: DocumentFieldRow;
  edit: FieldEdit | undefined;
  onChange: (raw: string) => void;
}) {
  const current = edit?.raw ?? fieldDisplayValue(field);
  return (
    <View style={styles.fieldEditor}>
      <View style={styles.fieldEditorHeader}>
        <AppText variant="captionMedium" tone="secondary">
          {field.label}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <Badge
            label={edit && edit.raw !== fieldDisplayValue(field) ? 'Corrected by you' : provenanceLabel(field.source)}
            kind={field.source === 'ai' && !(edit && edit.raw !== fieldDisplayValue(field)) ? 'info' : 'success'}
          />
          {isLowConfidence(field) ? <Badge label="Check this" kind="warning" icon="warning-outline" /> : null}
        </View>
      </View>
      <TextField
        value={current === '—' ? '' : current}
        onChangeText={onChange}
        error={edit?.error}
        hint={field.evidence_text ? `Document says: “${field.evidence_text}”${field.page_number ? ` (page ${field.page_number})` : ''}` : undefined}
        accessibilityLabel={`Edit ${field.label}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  preview: { height: 200, marginBottom: spacing.lg },
  groupLabel: { marginBottom: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tagChip: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  fieldEditor: { marginBottom: spacing.sm },
  fieldEditorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs, flexWrap: 'wrap', gap: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
});
