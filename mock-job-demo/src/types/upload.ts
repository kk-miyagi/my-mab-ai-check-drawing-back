// Centralized types for upload flow

export type UploadPhase = 'idle' | 'issuing_id' | 'uploading' | 'verifying' | 'complete' | 'error';

// --- Operation ID issuance ---
export interface OperationIssueRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string | null; // always empty/null when requesting issuance
  status: 'start';
}

export interface OperationIssueResponse {
  operation_id: string;
  status: string;
  message?: string;
}

// --- Upload requests/responses ---
export interface UploadPairRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'doing';
  number: number; // upload sequence (1-based)
  files: File[]; // up to 2 files per request
}

export interface UploadCompleteRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'end';
  sum_number: number; // total requests sent (pairs count)
}

export interface UploadResponse {
  status: 'doing' | 'end' | 'error';
  operation_id?: string;
  sum_number?: number;
  number?: number; // file number needing reupload (-1 means all)
  file_name?: string;
  message?: string;
}

export interface UploadResult extends UploadResponse {
  operationId: string;
}
