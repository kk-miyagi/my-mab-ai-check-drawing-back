export type Status = 'start' | 'doing' | 'end' | 'error' | string;

export type Operations = {
  operation: string;
  operation_id: string;
  status: Status;
}

export interface GroupIdRequest {
  user: string;
  epic: string;
  group_id: string | null;
  group_status: Status | null;
  others: Record<string, any> | null;
  operations: Operations[] | null;
}

export interface GroupIdResponse {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}
