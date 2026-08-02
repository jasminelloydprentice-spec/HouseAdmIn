import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../../src/components/AppText';
import { Badge } from '../../../../src/components/Badge';
import { Button } from '../../../../src/components/Button';
import { Card } from '../../../../src/components/Card';
import { ErrorView, LoadingView } from '../../../../src/components/StateViews';
import { categoryLabel } from '../../../../src/config/categories';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { getSignedUrl } from '../../../../src/features/documents/api';
import {
  fieldDisplayValue,
  isLowConfidence,
  provenanceLabel,
  sortFields,
} from '../../../../src/features/documents/fieldPresentation';
import { useDeleteDocument, useDocumentDetail } from '../../../../src/features/documents/hooks';
import { SignedImage } from '../../../../src/features/documents/SignedImage';
import { STATUS_META } from '../../../../src/features/documents/statusMeta';
import { DocumentFieldRow } from '../../../../src/features/documents/types';
import { requestProcessing } from '../../../../src/features/documents/upload';
import { colors, radius, spacing } from '../../../../src/theme';
import { formatUkDate, formatUkDateTime, relativeDayLabel } from '../../../../src/utils/dates';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { householdId } = useAuth();
  const { data: doc, isLoading, isError, refetch } = useDocumentDetail(id, { refetchWhileProcessing: true });
  const deleteMutation = useDeleteDocument();
  const [evidenceField, setEvidenceField] = useState<DocumentFieldRow | null>(null);
  const [showText, setShowText] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <LoadingView message="Loading document…" />;
  if (isError || !doc) return <ErrorView message="This document could not be loaded." onRetry={() => void refetch()} />;

  const status = STATUS_META[doc.status];
  const originals = doc.document_files.filter((f) => f.kind === 'original');
  const pdfFile = originals.find((f) => f.mime_type === 'application/pdf');
  const imagePages = originals.filter((f) => f.mime_type.startsWith('image/')).sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0));
  const fields = sortFields(doc.document_fields);

  const openOriginal = async (pageNumber?: number) => {
    try {
      setBusy(true);
      const target = pdfFile ?? imagePages.find((f) => f.page_number === pageNumber) ?? originals[0];
      if (!target) return;
      const url = await getSignedUrl(target.storage_path);
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Could not open document', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      setBusy(true);
      const target = pdfFile ?? originals[0];
      if (!target) return;
      const url = await getSignedUrl(target.storage_path);
      const filename = doc.original_filename ?? target.storage_path.split('/').pop() ?? 'document';
      const dest = new File(Paths.cache, filename);
      if (dest.exists) dest.delete();
      const downloaded = await File.downloadFileAsync(url, dest);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloaded.uri);
      } else {
        Alert.alert('Downloaded', `Saved to ${downloaded.uri}`);
      }
    } catch {
      Alert.alert('Download failed', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const exportMetadata = async () => {
    try {
      setBusy(true);
      const payload = {
        exported_at: new Date().toISOString(),
        document: {
          title: doc.title,
          category: doc.category,
          provider: doc.provider,
          type: doc.doc_type,
          document_date: doc.document_date,
          summary: doc.summary,
          action_required: doc.action_required,
          deadline_date: doc.deadline_date,
          renewal_date: doc.renewal_date,
          expiry_date: doc.expiry_date,
        },
        fields: doc.document_fields.map((f) => ({
          label: f.label,
          value: fieldDisplayValue(f),
          source: f.source,
          confidence: f.confidence,
          page: f.page_number,
        })),
      };
      const file = new File(Paths.cache, `document-metadata-${doc.id.slice(0, 8)}.json`);
      if (file.exists) file.delete();
      file.write(JSON.stringify(payload, null, 2));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
    } catch {
      Alert.alert('Export failed', 'Metadata could not be exported.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this document?',
      'The original file, extracted details and any reminders will be permanently deleted for your whole household. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(doc, {
              onSuccess: () => router.back(),
              onError: () => Alert.alert('Delete failed', 'The document could not be deleted. Try again.'),
            });
          },
        },
      ],
    );
  };

  const retryAnalysis = async () => {
    if (!householdId) return;
    try {
      setBusy(true);
      await requestProcessing(doc.id, householdId);
      void refetch();
    } catch (err) {
      Alert.alert('Could not start analysis', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.navActions}>
          {doc.status === 'needs_review' || doc.status === 'ready' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit document details"
              onPress={() => router.push(`/document/${doc.id}/review`)}
              hitSlop={8}
              style={styles.navButton}
            >
              <Ionicons name="create-outline" size={22} color={colors.accent} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Delete document" onPress={confirmDelete} hitSlop={8} style={styles.navButton}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <AppText variant="title">{doc.title}</AppText>
        <View style={styles.metaRow}>
          <Badge label={categoryLabel(doc.category)} kind="accent" icon="folder-outline" />
          {doc.provider ? <Badge label={doc.provider} kind="neutral" icon="business-outline" /> : null}
          {doc.people ? <Badge label={doc.people.name} kind="neutral" icon="person-outline" /> : null}
          {doc.is_sensitive ? <Badge label="Sensitive" kind="danger" icon="lock-closed-outline" /> : null}
          <Badge label={status.label} kind={status.kind} icon={status.icon} />
        </View>

        {status.busy ? (
          <Card style={styles.section}>
            <AppText variant="bodyMedium">{status.label}…</AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
              You can leave this screen — the document will keep processing and appear updated when you return.
            </AppText>
          </Card>
        ) : null}

        {doc.status === 'failed' ? (
          <Card style={styles.section}>
            <AppText variant="bodyMedium" tone="danger">
              Analysis failed
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
              The original document is safe. You can retry analysis or fill in details manually via Edit.
            </AppText>
            <Button title="Retry analysis" variant="secondary" onPress={() => void retryAnalysis()} loading={busy} style={{ marginTop: spacing.md }} />
          </Card>
        ) : null}

        {doc.status === 'needs_review' ? (
          <Card style={styles.section}>
            <AppText variant="bodyMedium">Review the extracted details</AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
              Check what was found, correct anything wrong, then save.
            </AppText>
            <Button title="Review and save" onPress={() => router.push(`/document/${doc.id}/review`)} style={{ marginTop: spacing.md }} />
          </Card>
        ) : null}

        {/* Preview */}
        <View style={styles.section}>
          <AppText variant="heading" style={styles.sectionTitle}>
            Original document
          </AppText>
          {pdfFile ? (
            <Card onPress={() => void openOriginal()} accessibilityLabel="Open the original PDF">
              <View style={styles.pdfRow}>
                <Ionicons name="document-outline" size={26} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {doc.original_filename ?? 'Original PDF'}
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    Tap to open securely
                  </AppText>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.textMuted} />
              </View>
            </Card>
          ) : imagePages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {imagePages.map((f) => (
                <Pressable key={f.id} accessibilityRole="imagebutton" accessibilityLabel={`Open page ${f.page_number}`} onPress={() => void openOriginal(f.page_number ?? undefined)}>
                  <SignedImage storagePath={f.storage_path} style={styles.pagePreview} accessibilityLabel={`Page ${f.page_number}`} />
                  <AppText variant="caption" tone="muted" align="center" style={{ marginTop: spacing.xs }}>
                    Page {f.page_number}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <AppText variant="caption" tone="muted">
              No files stored for this document.
            </AppText>
          )}
        </View>

        {/* Summary */}
        {doc.summary ? (
          <View style={styles.section}>
            <AppText variant="heading" style={styles.sectionTitle}>
              Summary
            </AppText>
            <Card>
              <AppText>{doc.summary}</AppText>
              <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                {doc.summary_source === 'ai' ? 'AI-generated summary — verify important details against the original.' : 'Summary confirmed by you.'}
              </AppText>
            </Card>
          </View>
        ) : null}

        {/* Key dates & action */}
        {(doc.action_required || doc.deadline_date || doc.renewal_date || doc.expiry_date || doc.document_date) && (
          <View style={styles.section}>
            <AppText variant="heading" style={styles.sectionTitle}>
              Dates and actions
            </AppText>
            <Card>
              {doc.action_required ? (
                <DetailRow icon="flag-outline" label="Action required" value={doc.action_required} emphasis />
              ) : null}
              {doc.deadline_date ? (
                <DetailRow icon="alarm-outline" label="Deadline" value={`${formatUkDate(doc.deadline_date)} (${relativeDayLabel(doc.deadline_date) ?? ''})`} />
              ) : null}
              {doc.renewal_date ? (
                <DetailRow icon="refresh-outline" label="Renewal" value={`${formatUkDate(doc.renewal_date)} (${relativeDayLabel(doc.renewal_date) ?? ''})`} />
              ) : null}
              {doc.expiry_date ? (
                <DetailRow icon="hourglass-outline" label="Expires" value={`${formatUkDate(doc.expiry_date)} (${relativeDayLabel(doc.expiry_date) ?? ''})`} />
              ) : null}
              {doc.document_date ? <DetailRow icon="calendar-outline" label="Document date" value={formatUkDate(doc.document_date)} /> : null}
              {(doc.deadline_date || doc.renewal_date || doc.expiry_date) ? (
                <Button
                  title="Create reminder"
                  variant="secondary"
                  icon="notifications-outline"
                  onPress={() =>
                    router.push({
                      pathname: '/reminder/new',
                      params: {
                        documentId: doc.id,
                        title: doc.title,
                        dueDate: doc.deadline_date ?? doc.renewal_date ?? doc.expiry_date ?? '',
                      },
                    })
                  }
                  style={{ marginTop: spacing.md }}
                />
              ) : null}
            </Card>
          </View>
        )}

        {/* Extracted fields */}
        {fields.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="heading" style={styles.sectionTitle}>
              Extracted details
            </AppText>
            <Card>
              {fields.map((field, i) => (
                <Pressable
                  key={field.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${field.label}: ${fieldDisplayValue(field)}. ${provenanceLabel(field.source)}. Tap to see the supporting page.`}
                  onPress={() => setEvidenceField(field)}
                  style={[styles.fieldRow, i > 0 && styles.fieldDivider]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption" tone="secondary">
                      {field.label}
                    </AppText>
                    <AppText variant="bodyMedium" style={{ marginTop: 2 }}>
                      {fieldDisplayValue(field)}
                    </AppText>
                    <View style={styles.fieldMeta}>
                      <Badge
                        label={provenanceLabel(field.source)}
                        kind={field.source === 'ai' ? 'info' : 'success'}
                        icon={field.source === 'ai' ? 'sparkles-outline' : 'checkmark-outline'}
                      />
                      {isLowConfidence(field) ? <Badge label="Low confidence" kind="warning" icon="warning-outline" /> : null}
                    </View>
                  </View>
                  {field.page_number ? <Ionicons name="document-text-outline" size={16} color={colors.textMuted} /> : null}
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Extracted text */}
        {doc.document_pages.length > 0 ? (
          <View style={styles.section}>
            <Pressable accessibilityRole="button" accessibilityLabel={showText ? 'Hide extracted text' : 'Show extracted text'} onPress={() => setShowText((v) => !v)} style={styles.disclosure}>
              <AppText variant="heading">Extracted text</AppText>
              <Ionicons name={showText ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {showText ? (
              <Card>
                {doc.document_pages.map((p) => (
                  <View key={p.id} style={{ marginBottom: spacing.md }}>
                    <AppText variant="captionMedium" tone="muted">
                      Page {p.page_number}
                      {p.is_unreadable ? ' · partly unreadable' : ''}
                    </AppText>
                    <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
                      {p.text || '(no text found)'}
                    </AppText>
                  </View>
                ))}
              </Card>
            ) : null}
          </View>
        ) : null}

        {/* Processing history */}
        {doc.processing_jobs.length > 0 ? (
          <View style={styles.section}>
            <Pressable accessibilityRole="button" accessibilityLabel={showHistory ? 'Hide processing history' : 'Show processing history'} onPress={() => setShowHistory((v) => !v)} style={styles.disclosure}>
              <AppText variant="heading">Processing history</AppText>
              <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {showHistory ? (
              <Card>
                {doc.processing_jobs.map((job) => (
                  <View key={job.id} style={{ marginBottom: spacing.sm }}>
                    <AppText variant="caption">
                      {formatUkDateTime(job.created_at)} — {job.status}
                      {job.error ? ` · ${job.error}` : ''}
                    </AppText>
                  </View>
                ))}
              </Card>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Button title="Download original" variant="secondary" icon="download-outline" onPress={() => void download()} loading={busy} />
          <Button title="Export details as JSON" variant="ghost" icon="code-download-outline" onPress={() => void exportMetadata()} style={{ marginTop: spacing.sm }} />
        </View>
      </ScrollView>

      {/* Evidence modal: the supporting page + quote for a fact */}
      <Modal visible={!!evidenceField} transparent animationType="slide" onRequestClose={() => setEvidenceField(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            {evidenceField ? (
              <>
                <View style={styles.modalHeader}>
                  <AppText variant="heading">{evidenceField.label}</AppText>
                  <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setEvidenceField(null)} hitSlop={8}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </Pressable>
                </View>
                <AppText variant="title" tone="accent" style={{ marginTop: spacing.sm }}>
                  {fieldDisplayValue(evidenceField)}
                </AppText>
                <View style={styles.fieldMeta}>
                  <Badge label={provenanceLabel(evidenceField.source)} kind={evidenceField.source === 'ai' ? 'info' : 'success'} />
                  {evidenceField.confidence !== null && evidenceField.source === 'ai' ? (
                    <Badge label={`Confidence ${(evidenceField.confidence * 100).toFixed(0)}%`} kind={isLowConfidence(evidenceField) ? 'warning' : 'neutral'} />
                  ) : null}
                </View>
                {evidenceField.evidence_text ? (
                  <View style={styles.quote}>
                    <AppText variant="caption" tone="secondary">
                      “{evidenceField.evidence_text}”
                    </AppText>
                    {evidenceField.page_number ? (
                      <AppText variant="captionMedium" tone="muted" style={{ marginTop: spacing.xs }}>
                        Found on page {evidenceField.page_number}
                      </AppText>
                    ) : null}
                  </View>
                ) : (
                  <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
                    No supporting text recorded for this field
                    {evidenceField.source !== 'ai' ? ' — it was entered manually.' : '.'}
                  </AppText>
                )}
                {evidenceField.page_number && imagePages.some((f) => f.page_number === evidenceField.page_number) ? (
                  <SignedImage
                    storagePath={imagePages.find((f) => f.page_number === evidenceField.page_number)!.storage_path}
                    style={styles.evidenceImage}
                    accessibilityLabel={`Page ${evidenceField.page_number} of the original document`}
                  />
                ) : null}
                <Button
                  title="Open original document"
                  variant="secondary"
                  icon="open-outline"
                  onPress={() => void openOriginal(evidenceField.page_number ?? undefined)}
                  style={{ marginTop: spacing.lg }}
                />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ icon, label, value, emphasis }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={emphasis ? colors.warning : colors.textSecondary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
        <AppText variant={emphasis ? 'bodyMedium' : 'body'}>{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  navActions: { flexDirection: 'row' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  section: { marginTop: spacing.xl },
  sectionTitle: { marginBottom: spacing.md },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pagePreview: { width: 140, height: 190 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  fieldDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  fieldMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  disclosure: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, minHeight: 44 },
  detailRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quote: {
    marginTop: spacing.lg,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  evidenceImage: { height: 260, marginTop: spacing.lg },
});
