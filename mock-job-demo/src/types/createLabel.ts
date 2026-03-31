export interface CreateLabelRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | string;
}

export interface CreateLabelResponse {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | 'error' | string;
  message: string;
}

export type Phase = 'idle' | 'issuing_id' | 'uploading' | 'verifying' | 'complete' | 'error';

export type CsvRow = Record<string, string>
