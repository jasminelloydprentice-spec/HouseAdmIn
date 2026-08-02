import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/AppText';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { fetchChecksums } from '../../../src/features/documents/api';
import {
  computeInputChecksum,
  DraftPage,
  looksBlurry,
  UploadError,
  UploadInput,
  uploadDocument,
  UploadProgress,
} from '../../../src/features/documents/upload';
import { colors, radius, spacing, touchTarget } from '../../../src/theme';
import { findDuplicate } from '../../../src/utils/checksum';

type Mode = 'chooser' | 'camera' | 'review' | 'uploading' | 'error';

interface UploadFailure {
  message: string;
  retryable: boolean;
  documentId?: string;
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { session, householdId } = useAuth();
  const [mode, setMode] = useState<Mode>('chooser');
  const [pages, setPages] = useState<DraftPage[]>([]);
  const [pdf, setPdf] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [blurryIds, setBlurryIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [failure, setFailure] = useState<UploadFailure | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const uploadingRef = useRef(false);

  const reset = useCallback(() => {
    setMode('chooser');
    setPages([]);
    setPdf(null);
    setBlurryIds(new Set());
    setProgress(null);
    setFailure(null);
  }, []);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera access needed',
          'To photograph paperwork, allow camera access in Settings. You can still import photos or PDFs.',
        );
        return;
      }
    }
    setMode('camera');
  };

  const capturePage = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    if (!photo) return;
    const id = Crypto.randomUUID();
    let blurry = false;
    try {
      const size = new File(photo.uri).size ?? 0;
      blurry = looksBlurry(size, photo.width, photo.height);
    } catch {
      // Size unavailable — skip the heuristic.
    }
    setPages((prev) => [...prev, { id, uri: photo.uri, rotation: 0, width: photo.width, height: photo.height }]);
    if (blurry) setBlurryIds((prev) => new Set(prev).add(id));
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 1,
    });
    if (result.canceled) return;
    setPages((prev) => [
      ...prev,
      ...result.assets.map((a) => ({ id: Crypto.randomUUID(), uri: a.uri, rotation: 0, width: a.width, height: a.height })),
    ]);
    setMode('review');
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 20 * 1024 * 1024) {
      Alert.alert('File too large', 'PDFs must be smaller than 20 MB.');
      return;
    }
    setPdf({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf' });
    setMode('review');
  };

  const movePage = (index: number, direction: -1 | 1) => {
    setPages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const rotatePage = (id: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
  };

  const removePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  };

  const proceedUpload = async (input: UploadInput, checksum: string, existingDocumentId?: string) => {
    if (!session?.user || !householdId) return;
    uploadingRef.current = true;
    setMode('uploading');
    try {
      const { documentId } = await uploadDocument({
        householdId,
        userId: session.user.id,
        input,
        checksum,
        existingDocumentId,
        onProgress: setProgress,
      });
      uploadingRef.current = false;
      reset();
      router.push(`/document/${documentId}`);
    } catch (err) {
      uploadingRef.current = false;
      const e = err instanceof UploadError ? err : new UploadError('The upload was interrupted.', true);
      setFailure({ message: e.message, retryable: e.retryable });
      setMode('error');
    }
  };

  const startUpload = async (existingDocumentId?: string) => {
    if (!session?.user || !householdId || uploadingRef.current) return;
    const input: UploadInput = pdf ? { kind: 'pdf', ...pdf } : { kind: 'images', pages };
    uploadingRef.current = true;
    setMode('uploading');
    setFailure(null);
    try {
      const checksum = await computeInputChecksum(input);
      if (!existingDocumentId) {
        const existing = await fetchChecksums(householdId);
        const duplicate = findDuplicate(checksum, existing);
        if (duplicate) {
          uploadingRef.current = false;
          Alert.alert('Possible duplicate', `This looks identical to “${duplicate.title}”. Add it anyway?`, [
            { text: 'Cancel', style: 'cancel', onPress: () => setMode('review') },
            { text: 'Add anyway', onPress: () => void proceedUpload(input, checksum) },
          ]);
          return;
        }
      }
      await proceedUpload(input, checksum, existingDocumentId);
    } catch (err) {
      uploadingRef.current = false;
      const e = err instanceof UploadError ? err : new UploadError('Something went wrong preparing the upload.', true);
      setFailure({ message: e.message, retryable: e.retryable });
      setMode('error');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────
  if (mode === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        {/* Framing guidance */}
        <View pointerEvents="none" style={styles.frameOverlay}>
          <View style={styles.frameGuide} />
          <AppText variant="captionMedium" style={styles.frameHint}>
            Fill the frame with the page · keep it flat and well lit
          </AppText>
        </View>
        <View style={[styles.cameraControls, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close camera" onPress={() => setMode(pages.length > 0 ? 'review' : 'chooser')} style={styles.cameraSecondary}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Capture page" onPress={() => void capturePage()} style={styles.shutter}>
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Finish capturing, ${pages.length} pages taken`}
            onPress={() => pages.length > 0 && setMode('review')}
            style={styles.cameraSecondary}
          >
            {pages.length > 0 ? (
              <View style={styles.pageCount}>
                <AppText variant="captionMedium" style={{ color: '#fff' }}>
                  {pages.length}
                </AppText>
              </View>
            ) : (
              <Ionicons name="checkmark" size={26} color="rgba(255,255,255,0.4)" />
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (mode === 'uploading') {
    const pct =
      progress && progress.stage === 'uploading' && progress.total > 0
        ? Math.round((progress.done / progress.total) * 100)
        : null;
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <AppText variant="title">Uploading…</AppText>
        <AppText tone="secondary" style={{ marginTop: spacing.sm }}>
          {progress?.stage === 'preparing' && 'Preparing pages'}
          {progress?.stage === 'uploading' && (pct !== null ? `Uploading ${progress.done + 1} of ${progress.total}` : 'Uploading')}
          {progress?.stage === 'finalising' && 'Finishing up'}
          {progress?.stage === 'queueing' && 'Queueing analysis'}
          {!progress && 'Starting'}
        </AppText>
        <View style={styles.progressTrack} accessibilityLabel={pct !== null ? `${pct} percent uploaded` : 'Uploading'}>
          <View style={[styles.progressFill, { width: pct !== null ? `${pct}%` : '15%' }]} />
        </View>
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.lg }}>
          You can keep the app open — this usually takes a few seconds per page.
        </AppText>
      </View>
    );
  }

  if (mode === 'error' && failure) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.danger} />
        <AppText variant="title" style={{ marginTop: spacing.lg }}>
          Upload interrupted
        </AppText>
        <AppText tone="secondary" align="center" style={{ marginTop: spacing.sm }}>
          {failure.message}
        </AppText>
        {failure.retryable ? (
          <Button title="Retry upload" onPress={() => void startUpload(failure.documentId)} style={{ marginTop: spacing.xl }} />
        ) : null}
        <Button title="Back to pages" variant="secondary" onPress={() => setMode('review')} style={{ marginTop: spacing.sm }} />
      </View>
    );
  }

  if (mode === 'review') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <AppText variant="largeTitle">Check pages</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Discard and start again" onPress={reset} hitSlop={8}>
            <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {pdf ? (
            <Card style={{ marginTop: spacing.lg }}>
              <View style={styles.pdfRow}>
                <Ionicons name="document-outline" size={28} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {pdf.name}
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    PDF · the original file will be preserved
                  </AppText>
                </View>
              </View>
            </Card>
          ) : (
            pages.map((page, index) => (
              <Card key={page.id} style={{ marginTop: spacing.lg }}>
                <View style={styles.pageRow}>
                  <Image
                    source={{ uri: page.uri }}
                    style={[styles.thumb, { transform: [{ rotate: `${page.rotation}deg` }] }]}
                    accessibilityLabel={`Page ${index + 1} preview`}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium">Page {index + 1}</AppText>
                    {blurryIds.has(page.id) ? (
                      <View style={styles.blurWarning}>
                        <Ionicons name="warning-outline" size={14} color={colors.warning} />
                        <AppText variant="caption" style={{ color: colors.warning, flex: 1 }}>
                          This page may be blurry — consider retaking it.
                        </AppText>
                      </View>
                    ) : null}
                    <View style={styles.pageActions}>
                      <IconAction label={`Move page ${index + 1} up`} icon="arrow-up" disabled={index === 0} onPress={() => movePage(index, -1)} />
                      <IconAction
                        label={`Move page ${index + 1} down`}
                        icon="arrow-down"
                        disabled={index === pages.length - 1}
                        onPress={() => movePage(index, 1)}
                      />
                      <IconAction label={`Rotate page ${index + 1}`} icon="refresh-outline" onPress={() => rotatePage(page.id)} />
                      <IconAction label={`Delete page ${index + 1}`} icon="trash-outline" tone="danger" onPress={() => removePage(page.id)} />
                    </View>
                  </View>
                </View>
              </Card>
            ))
          )}
          {!pdf ? (
            <Button title="Add another page" variant="secondary" icon="camera-outline" onPress={() => void openCamera()} style={{ marginTop: spacing.lg }} />
          ) : null}
          <Button
            title="Upload securely"
            icon="cloud-upload-outline"
            onPress={() => void startUpload()}
            disabled={!pdf && pages.length === 0}
            style={{ marginTop: spacing.md }}
          />
          <AppText variant="caption" tone="muted" align="center" style={{ marginTop: spacing.md }}>
            Stored privately for your household. Analysis happens after upload and you review everything before it’s saved.
          </AppText>
        </ScrollView>
      </View>
    );
  }

  // chooser
  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <AppText variant="largeTitle" style={{ paddingHorizontal: 0 }}>
        Scan paperwork
      </AppText>
      <AppText tone="secondary" style={{ marginTop: spacing.sm }}>
        Add a letter or document. The original is always kept safe.
      </AppText>
      <Card onPress={() => void openCamera()} accessibilityLabel="Photograph pages with the camera" style={{ marginTop: spacing.xl }}>
        <ChooserRow icon="camera-outline" title="Photograph pages" subtitle="Snap each page of a letter" />
      </Card>
      <Card onPress={() => void pickImages()} accessibilityLabel="Choose existing photos" style={{ marginTop: spacing.md }}>
        <ChooserRow icon="images-outline" title="Choose photos" subtitle="Pick pages from your photo library" />
      </Card>
      <Card onPress={() => void pickPdf()} accessibilityLabel="Import a PDF file" style={{ marginTop: spacing.md }}>
        <ChooserRow icon="document-outline" title="Import a PDF" subtitle="From email attachments or provider apps" />
      </Card>
    </View>
  );
}

function ChooserRow({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  return (
    <View style={styles.chooserRow}>
      <View style={styles.chooserIcon}>
        <Ionicons name={icon} size={24} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="caption" tone="secondary">
          {subtitle}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </View>
  );
}

function IconAction({
  label,
  icon,
  onPress,
  disabled,
  tone,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconAction, disabled && { opacity: 0.35 }]}
    >
      <Ionicons name={icon} size={18} color={tone === 'danger' ? colors.danger : colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chooserRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chooserIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  frameOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frameGuide: {
    width: '82%',
    aspectRatio: 0.72,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.md,
    borderStyle: 'dashed',
  },
  frameHint: {
    color: '#fff',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  cameraSecondary: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  pageCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pageRow: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: 72, height: 96, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  pageActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurWarning: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progressTrack: {
    width: '80%',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.xl,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
});
