import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import {
  deleteDocument,
  DocumentUpdate,
  fetchChecksums,
  fetchDocumentDetail,
  fetchDocuments,
  fetchPeople,
  fetchProviders,
  fetchReminders,
  LibraryFilters,
  updateDocument,
} from './api';
import { DocumentDetail } from './types';

export function useDocuments(filters: LibraryFilters = {}) {
  const { householdId } = useAuth();
  return useQuery({
    queryKey: ['documents', householdId, filters],
    queryFn: () => fetchDocuments(householdId!, filters),
    enabled: !!householdId,
  });
}

export function useDocumentDetail(id: string | undefined, options?: { refetchWhileProcessing?: boolean }) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => fetchDocumentDetail(id!),
    enabled: !!id,
    refetchInterval: options?.refetchWhileProcessing
      ? (query) => {
          const status = query.state.data?.status;
          return status === 'queued' || status === 'processing' || status === 'uploading' ? 2500 : false;
        }
      : false,
  });
}

export function useProviders() {
  const { householdId } = useAuth();
  return useQuery({
    queryKey: ['providers', householdId],
    queryFn: () => fetchProviders(householdId!),
    enabled: !!householdId,
  });
}

export function usePeople() {
  const { householdId } = useAuth();
  return useQuery({
    queryKey: ['people', householdId],
    queryFn: () => fetchPeople(householdId!),
    enabled: !!householdId,
  });
}

export function useChecksums() {
  const { householdId } = useAuth();
  return useQuery({
    queryKey: ['checksums', householdId],
    queryFn: () => fetchChecksums(householdId!),
    enabled: !!householdId,
  });
}

export function useReminders() {
  const { householdId } = useAuth();
  return useQuery({
    queryKey: ['reminders', householdId],
    queryFn: () => fetchReminders(householdId!),
    enabled: !!householdId,
  });
}

export function useUpdateDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: DocumentUpdate) => updateDocument(id, update),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['document', id] });
      void qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doc: Pick<DocumentDetail, 'id' | 'household_id' | 'document_files'>) => deleteDocument(doc),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: ['reminders'] });
      void qc.invalidateQueries({ queryKey: ['checksums'] });
    },
  });
}
