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
