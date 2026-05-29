import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import type { DrawingReviewRequest, DrawingReviewResponse } from "../types/drawingReview.ts";

const DRAWING_REVIEW_ENDPOINT = ENDPOINTS.drawingReview;

export const drawingReviewApi = {

  async drawingReviewStart(payload: DrawingReviewRequest): Promise<DrawingReviewResponse> {
    const { data } = await http.post<DrawingReviewResponse>(DRAWING_REVIEW_ENDPOINT, payload);
    return data;
  },

  async drawingReviewEnd(payload: DrawingReviewRequest) {
    const { data } = await http.post<Blob>(DRAWING_REVIEW_ENDPOINT, payload, { responseType: 'blob' });
    return data;
  },

}