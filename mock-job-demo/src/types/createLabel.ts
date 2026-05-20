export type Status = 'start' | 'doing' | 'end' | 'error' | string;

export type Operations = {
  operation: string;
  operation_id: string;
  status: Status;
}

export interface CreateLabelRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}

export interface CreateLabelResponse {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}

export type NavigateState = CreateLabelRequest & {
  fileName: string;
}

export type Phase = 'idle' | 'issuing_id' | 'uploading' | 'verifying' | 'complete' | 'error';

export type CsvRow = Record<string, string>

export interface UpdateLabelInitRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}

export interface UpdateLabelRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
  rects?: Record<string, any>;
  info?: Record<string, any>;
}

export interface UpdateLabelResponse {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}
