export interface DrawingReviewRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | string;
}
