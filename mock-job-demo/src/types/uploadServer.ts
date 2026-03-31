// Server-side (or server-mimic) request/response shapes used by the front-end

export interface OperationIssueRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string | null; // empty/null when requesting issuance
  status: 'start';
}

export interface OperationIssueResponse {
  operation_id: string;
  status: string;
  message?: string;
}

export interface UploadPairRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'doing';
  number: number; // upload sequence (1-based)
  files: File[]; // up to 2 files per request
  file_field_keys?: string[]; // optional custom field names per file (e.g., ['bf_file_csv','bf_file'])
}

export interface UploadCompleteRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'end';
  sum_number: number; // total requests sent (pairs count)
}

export interface EpicInitRequest {
  user: string;
  epic: string;
  operation: string; // typically 'init'
  operation_id: string;
  status: 'doing' | 'end';
}

export interface EpicInitResponse {
  status: string;
  message?: string;
  operation_id?: string;
}

export interface UploadResponse {
  status: 'doing' | 'end' | 'error';
  operation_id?: string;
  sum_number?: number;
  number?: number; // file number needing reupload (-1 means all)
  file_name?: string;
  message?: string;
}
