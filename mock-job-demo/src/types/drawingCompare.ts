export type Status = 'start' | 'doing' | 'end' | 'error' | string;

export type Operations = {
  operation: string;
  operation_id: string;
  status: Status;
}

export type Combinations = Record<string, string[]>;

export interface DrawingCompareRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
  combinations?: Combinations;
}

export interface DrawingCompareResponse {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}
