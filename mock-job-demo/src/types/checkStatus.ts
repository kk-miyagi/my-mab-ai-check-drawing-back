export type Operations = {
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | string;
}

export interface CheckStatusRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: 'start' | 'doing' | 'end' | string;
  others: Record<string, string> | null;
  operations: Operations[];
}

export interface CheckStatusResponse {
  user: string;
  epic: string;
  group_id: string;
  group_status: 'start' | 'doing' | 'end' | string;
  others: Record<string, string> | null;
  operations: Operations[];
}
