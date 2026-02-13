export interface DrawingReviewRequest {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | string;
}

export interface DrawingReviewResponse {
  user: string;
  epic: string;
  operation: string;
  operation_id: string;
  status: 'start' | 'doing' | 'end' | 'error' | string;
  message: string;
}

export interface ImageFile {
  file: File;
}
  
export interface ImagePair {
  base: string;
  image1: ImageFile;
  image2: ImageFile;
  excel: string;
  checkVersion: number;
}
