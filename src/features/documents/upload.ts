import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '../../lib/supabase';
import { bytesToHex } from '../../utils/checksum';

export interface DraftPage {
  id: string;
  uri: string;
  /** Extra clockwise rotation the user applied, in degrees. */
  rotation: number;
  width?: number;
  height?: number;
}

export type UploadInput =
  | { kind: 'images'; pages: DraftPage[] }
  | { kind: 'pdf'; uri: string; name: string; mimeType: string };

export type UploadStage = 'preparing' | 'uploading' | 'finalising' | 'queueing';

export interface UploadProgress {
  stage: UploadStage;
  /** Completed unit count for the current stage. */
  done: number;
  total: number;
}

export interface UploadResult {
  documentId: string;
  checksum: string;
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 20;
const TARGET_WIDTH = 1600;
const JPEG_QUALITY = 0.75;

export class UploadError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes.slice().buffer);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Read a local file's bytes.
 *
 * Camera, photo-library and document-picker URIs are not uniformly readable
 * by the expo-file-system `File` class (asset-library and content URIs in
 * particular), so fall back to `fetch`, which resolves local URIs on both
 * platforms. Throws an UploadError naming the URI scheme when both fail, so
 * the cause is visible rather than "something went wrong".
 */
async function readFileBytes(uri: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await new File(uri).arrayBuffer());
  } catch (fileError) {
    try {
      const response = await fetch(uri);
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      const scheme = uri.split(':')[0];
      throw new UploadError(
        `Could not read the selected file (${scheme} source): ${
          fileError instanceof Error ? fileError.message : String(fileError)
        }`,
        false,
      );
    }
  }
}

async function compressPage(page: DraftPage): Promise<Uint8Array> {
  const ctx = ImageManipulator.manipulate(page.uri);
  if (page.rotation % 360 !== 0) ctx.rotate(page.rotation % 360);
  ctx.resize({ width: TARGET_WIDTH });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return readFileBytes(saved.uri);
}

/**
 * Heuristic blur check: sharp document photos compress poorly (lots of
 * edges), blurred ones compress extremely well. Very low bytes-per-pixel
 * after JPEG compression is a hint, not a verdict — the UI shows a warning
 * and lets the user decide. Never blocks the upload.
 */
export function looksBlurry(byteLength: number, width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const bytesPerPixel = byteLength / (width * height);
  return bytesPerPixel < 0.02;
}

/** Compute the checksum for an input without uploading (used for dedupe pre-check). */
export async function computeInputChecksum(input: UploadInput): Promise<string> {
  if (input.kind === 'pdf') {
    return sha256Hex(await readFileBytes(input.uri));
  }
  // Hash of page-hash concatenation: stable for the same set of images in order.
  let combined = '';
  for (const page of input.pages) {
    combined += await sha256Hex(await readFileBytes(page.uri));
  }
  return sha256Hex(new TextEncoder().encode(combined));
}

/**
 * Upload a draft as a new document, or retry an interrupted upload of an
 * existing one (pass `existingDocumentId` — completed files are skipped via
 * upsert and the same storage paths are reused).
 */
export async function uploadDocument(options: {
  householdId: string;
  userId: string;
  input: UploadInput;
  checksum: string;
  existingDocumentId?: string;
  onProgress?: (p: UploadProgress) => void;
}): Promise<UploadResult> {
  const { householdId, userId, input, checksum, existingDocumentId, onProgress } = options;
  const report = (stage: UploadStage, done: number, total: number) => onProgress?.({ stage, done, total });

  if (input.kind === 'images' && input.pages.length === 0) {
    throw new UploadError('There are no pages to upload.', false);
  }
  if (input.kind === 'images' && input.pages.length > MAX_PAGES) {
    throw new UploadError(`A document can have at most ${MAX_PAGES} pages.`, false);
  }

  report('preparing', 0, 1);

  // 1. Create or reuse the document row.
  let documentId = existingDocumentId;
  if (!documentId) {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        household_id: householdId,
        created_by: userId,
        status: 'uploading',
        checksum,
        original_filename: input.kind === 'pdf' ? input.name : null,
        page_count: input.kind === 'images' ? input.pages.length : 0,
      })
      .select('id')
      .single();
    if (error) throw new UploadError(`Could not create the document record: ${error.message}`, true);
    documentId = data.id as string;
  }

  const basePath = `${householdId}/${documentId}`;

  // 2. Upload files.
  try {
    if (input.kind === 'pdf') {
      const bytes = await readFileBytes(input.uri);
      if (bytes.byteLength > MAX_PDF_BYTES) {
        throw new UploadError('PDFs must be smaller than 20 MB.', false);
      }
      report('uploading', 0, 1);
      const path = `${basePath}/original/document.pdf`;
      const { error } = await supabase.storage
        .from('documents')
        .upload(path, bytes.slice().buffer, { contentType: 'application/pdf', upsert: true });
      if (error) throw new UploadError(`Uploading the PDF failed: ${error.message}`, true);
      const { error: metaError } = await supabase.from('document_files').upsert(
        {
          document_id: documentId,
          household_id: householdId,
          kind: 'original',
          storage_path: path,
          mime_type: 'application/pdf',
          size_bytes: bytes.byteLength,
          checksum,
          original_filename: input.name,
        },
        { onConflict: 'storage_path' },
      );
      // A missing metadata row would orphan the stored object (untracked by
      // delete/analyse), so treat it as a retryable failure, not silent.
      if (metaError) throw new UploadError('Saving the uploaded file failed. You can retry.', true);
      report('uploading', 1, 1);
    } else {
      const total = input.pages.length;
      for (let i = 0; i < total; i++) {
        report('uploading', i, total);
        const bytes = await compressPage(input.pages[i]);
        const pageNumber = i + 1;
        const path = `${basePath}/original/page-${pageNumber}.jpg`;
        const { error } = await supabase.storage
          .from('documents')
          .upload(path, bytes.slice().buffer, { contentType: 'image/jpeg', upsert: true });
        if (error) throw new UploadError(`Uploading page ${pageNumber} failed: ${error.message}`, true);
        const { error: metaError } = await supabase.from('document_files').upsert(
          {
            document_id: documentId,
            household_id: householdId,
            kind: 'original',
            storage_path: path,
            page_number: pageNumber,
            mime_type: 'image/jpeg',
            size_bytes: bytes.byteLength,
            checksum: await sha256Hex(bytes),
          },
          { onConflict: 'storage_path' },
        );
        if (metaError) throw new UploadError(`Saving page ${pageNumber} failed. You can retry.`, true);
      }
      report('uploading', total, total);
    }
  } catch (err) {
    // Leave the document in 'uploading' so the retry path can resume it.
    if (err instanceof UploadError) throw err;
    throw new UploadError(
      `The upload was interrupted: ${err instanceof Error ? err.message : String(err)}`,
      true,
    );
  }

  // 3. Mark uploaded → queued and enqueue processing.
  report('finalising', 0, 1);
  const { error: statusError } = await supabase
    .from('documents')
    .update({ status: 'queued', page_count: input.kind === 'images' ? input.pages.length : 0 })
    .eq('id', documentId);
  if (statusError) throw new UploadError('Upload finished but the document could not be queued. Retry.', true);

  report('queueing', 0, 1);
  const { error: jobError } = await supabase.from('processing_jobs').insert({
    document_id: documentId,
    household_id: householdId,
    status: 'queued',
  });
  if (jobError) {
    // Non-fatal: processing can be started from the document screen.
    console.warn('Failed to enqueue processing job');
  }

  // Fire the processing function; failures leave the document queued and the
  // detail screen offers a retry.
  supabase.functions.invoke('process-document', { body: { documentId } }).catch(() => undefined);

  return { documentId, checksum };
}

/** Re-request analysis for a document that is queued/failed. */
export async function requestProcessing(documentId: string, householdId: string): Promise<void> {
  await supabase.from('documents').update({ status: 'queued' }).eq('id', documentId);
  await supabase.from('processing_jobs').insert({
    document_id: documentId,
    household_id: householdId,
    status: 'queued',
  });
  const { error } = await supabase.functions.invoke('process-document', { body: { documentId } });
  if (error) throw new Error('Could not start analysis. Check your connection and try again.');
}
