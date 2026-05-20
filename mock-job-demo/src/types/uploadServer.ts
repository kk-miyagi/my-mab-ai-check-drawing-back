export type Status = 'start' | 'doing' | 'end' | 'error' | string;

export type Operations = {
  operation: string;
  operation_id: string | null;
  status: Status;
}

export interface OperationIssueRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status | null;
  others: Record<string, any> | null;
  operations: Operations[] | null;
}

export interface OperationIssueResponse {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}

export interface UploadPairRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any> | null;
  operations: Operations[] | null;
  number: number,
  bf_file: File | null;
  af_file: File | null;
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
