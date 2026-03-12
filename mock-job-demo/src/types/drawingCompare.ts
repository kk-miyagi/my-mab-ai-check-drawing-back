export interface GetImageSimilarityRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | string;
}

export type Similarity = Record<string, Record<string, number>>;

export type Rect = Record<string, [number, number, number, number]>;

export interface GetImageSimilarityResponse {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | 'error' | string;
  base_rects: Rect;
  target_rects: Rect;
  similarities: Similarity
}

export type Combinations = Record<string, string[]>;

export interface DrawingCompareRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | string;
  combinations: Combinations;
}

export interface DrawingCompareEndRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | string;
}

export interface DrawingCompareResponse {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | 'error' | string;
  message: string;
}
