import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import { AxiosRequestConfig } from "axios";
import type { DrawingHighlightRequest } from "../types/drawingHighlight.ts";


const DRAWING_HIGHLIGHT_ENDPOINT = ENDPOINTS.drawingHighlight;

async function postForm<TResponse>(path: string, formData: FormData, responseType:  AxiosRequestConfig["responseType"] = 'json'): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: responseType
  });
  return data;
}

export const drawingHighlightApi = {

  async DrawingHighligh(payload: DrawingHighlightRequest) {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(DRAWING_HIGHLIGHT_ENDPOINT, form, 'blob')
  }

}