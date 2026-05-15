export type Status = 'start' | 'doing' | 'end' | 'error' | string;

export type Operations = {
  operation: string;
  operation_id: string;
  status: Status;
}

export interface StatusListRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}

export interface StatusListResponse {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}
