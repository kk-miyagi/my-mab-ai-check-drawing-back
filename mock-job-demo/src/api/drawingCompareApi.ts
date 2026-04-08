import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import { AxiosRequestConfig } from "axios";
import type { DrawingCompareRequest, DrawingCompareEndRequest, DrawingCompareResponse } from "../types/drawingCompare.ts";

const DRAWING_COMPARE_ENDPOINT = ENDPOINTS.drawingCompare;

async function postForm<TResponse>(path: string, formData: FormData, responseType:  AxiosRequestConfig["responseType"] = 'json'): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: responseType
  });
  return data;
}

export const drawingCompareApi = {

  async drawingCompareStart(payload: DrawingCompareRequest): Promise<DrawingCompareResponse> {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    form.append('combinations', JSON.stringify(payload.combinations));
    return postForm(DRAWING_COMPARE_ENDPOINT, form);
  },

  async drawingCompareEnd(payload: DrawingCompareEndRequest): Promise<Blob> {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(DRAWING_COMPARE_ENDPOINT, form, 'blob');
  },

}