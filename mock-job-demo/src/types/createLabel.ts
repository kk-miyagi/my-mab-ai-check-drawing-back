export type Operations = {
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | string;
}

export interface CreateLabelRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: 'start' | 'doing' | 'end' | string;
  others: Record<string, string>;
  operations: Operations[];
}

export interface CreateLabelResponse {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | 'error' | string;
  message: string;
}

export type NavigateState = CreateLabelRequest & {
  fileName: string;
}

export type Phase = 'idle' | 'issuing_id' | 'uploading' | 'verifying' | 'complete' | 'error';

export type CsvRow = Record<string, string>

export interface UpdateLabelInitRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start';
}
