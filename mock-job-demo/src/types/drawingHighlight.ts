export type Status = 'start' | 'doing' | 'end' | 'error' | string;

export type Operations = {
  operation: string;
  operation_id: string;
  status: Status;
}

export type Combinations = Record<string, string[]>;

export interface DrawingHighlightRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
  combinations?: Combinations;
}

export interface DrawingHighlightResponse {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}
