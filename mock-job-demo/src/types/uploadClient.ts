// Client-side state and derived types for the upload flow

import type { UploadResponse } from './uploadServer';

export type UploadPhase = 'idle' | 'issuing_id' | 'uploading' | 'verifying' | 'complete' | 'error';

export interface FailedUpload {
  number: number;
  fileNames: string[];
  reason: string;
  files?: File[]; // original File objects retained on client for retry
}

export interface UploadResult extends UploadResponse {
  operationId: string;
  failedUploads?: FailedUpload[];
  totalRequests?: number;
}
