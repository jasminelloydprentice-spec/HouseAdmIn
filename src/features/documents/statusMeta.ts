import { DocumentStatus } from './types';

export interface StatusMeta {
  label: string;
  kind: 'neutral' | 'accent' | 'warning' | 'danger' | 'success' | 'info';
  icon: 'cloud-upload-outline' | 'time-outline' | 'sync-outline' | 'eye-outline' | 'checkmark-circle-outline' | 'alert-circle-outline';
  /** Statuses in flight — UI shows progress affordances. */
  busy: boolean;
}

export const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  uploading: { label: 'Uploading', kind: 'info', icon: 'cloud-upload-outline', busy: true },
  uploaded: { label: 'Uploaded', kind: 'info', icon: 'cloud-upload-outline', busy: true },
  queued: { label: 'Waiting to analyse', kind: 'info', icon: 'time-outline', busy: true },
  processing: { label: 'Analysing', kind: 'info', icon: 'sync-outline', busy: true },
  needs_review: { label: 'Review needed', kind: 'warning', icon: 'eye-outline', busy: false },
  ready: { label: 'Saved', kind: 'success', icon: 'checkmark-circle-outline', busy: false },
  failed: { label: 'Analysis failed', kind: 'danger', icon: 'alert-circle-outline', busy: false },
};
