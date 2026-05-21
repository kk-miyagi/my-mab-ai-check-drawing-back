import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import type { DrawingCompareRequest, DrawingCompareResponse } from "../types/drawingCompare.ts";

const DRAWING_COMPARE_ENDPOINT = ENDPOINTS.drawingCompare;

export const drawingCompareApi = {

  async drawingCompareStart(payload: DrawingCompareRequest): Promise<DrawingCompareResponse> {
    const { data } = await http.post<DrawingCompareResponse>(DRAWING_COMPARE_ENDPOINT, payload);
    return data;
  },

  async drawingCompareEnd(payload: DrawingCompareRequest): Promise<Blob> {
    const { data } = await http.post<Blob>(DRAWING_COMPARE_ENDPOINT, payload, { responseType: 'blob' });
    return data;
  },

}