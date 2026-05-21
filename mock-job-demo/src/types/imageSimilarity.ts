export type Status = 'start' | 'doing' | 'end' | 'error' | string;

export type Operations = {
  operation: string;
  operation_id: string;
  status: Status;
}

export interface GetImageSimilarityRequest {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
}

export type Similarity = Record<string, Record<string, number>>;

export type Rect = Record<string, [number, number, number, number]>;

export interface GetImageSimilarityResponse {
  user: string;
  epic: string;
  group_id: string;
  group_status: Status;
  others: Record<string, any>;
  operations: Operations[];
  base_rects: Rect;
  target_rects: Rect;
  similarities: Similarity
}
