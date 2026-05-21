import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import type { DrawingHighlightRequest, DrawingHighlightResponse } from "../types/drawingHighlight.ts";


const DRAWING_HIGHLIGHT_ENDPOINT = ENDPOINTS.drawingHighlight;

export const drawingHighlightApi = {

  async drawingHighlight(payload: DrawingHighlightRequest): Promise<DrawingHighlightResponse> {
    const { data } = await http.post<DrawingHighlightResponse>(DRAWING_HIGHLIGHT_ENDPOINT, payload);
    return data;
  },

  async drawingHighlightEnd(payload: DrawingHighlightRequest): Promise<Blob> {
    const { data } = await http.post<Blob>(DRAWING_HIGHLIGHT_ENDPOINT, payload, { responseType: 'blob' });
    return data;
  }

}