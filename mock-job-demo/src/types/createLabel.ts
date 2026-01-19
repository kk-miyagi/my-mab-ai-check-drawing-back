export interface CreateLabelRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | string;
}

export interface CreateLabelResponse {
  status: 'doing' | 'end' | 'error';
  operation_id?: string;
  file_name?: string;
  message?: string;
}

export interface CheckStatusRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'doing' | 'end';
}

export interface CheckStatusResponse {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | 'error' | string;
  message: string;
}

export type Phase = 'idle' | 'issuing_id' | 'uploading' | 'verifying' | 'complete' | 'error';

export type CsvRow = Record<string, string>
