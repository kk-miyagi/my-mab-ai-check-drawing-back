import type { UploadPhase, UploadResult, FailedUpload } from './uploadClient';

export interface StartOptions {
  epic?: string;
  operation?: string;
  allowedFileNames?: string[];
  isRetry?: boolean;
}

export interface UploadContextType {
  phase: UploadPhase;
  progress: number;
  completedRequests: number;
  totalRequests: number;
  failedUploads: FailedUpload[];
  logs: string[];
  operationId: string | null;
  lastEpic: string | null;
  lastOperation: string | null;
  resultData: UploadResult | null;
  startUpload: (files: File[], options?: StartOptions) => Promise<void>;
  reset: () => void;
}

export type PersistedFailedUpload = {
  number: number;
  fileNames: string[];
  reason?: string;
};

export type PersistedState = {
  phase: UploadPhase;
  progress: number;
  completedRequests: number;
  totalRequests: number;
  failedUploads: PersistedFailedUpload[];
  logs: string[];
  operationId: string | null;
  resultData: UploadResult | null;
  lastEpic: string | null;
  lastOperation: string | null;
  status: 'start' | 'doing' | 'end' | 'error';
};