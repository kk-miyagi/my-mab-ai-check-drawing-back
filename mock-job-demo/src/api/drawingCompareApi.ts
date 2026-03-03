import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import { AxiosRequestConfig } from "axios";
import type { GetImageRectsRequest, GetImageRectsResponse, DrawingCompareRequest, DrawingCompareResponse } from "../types/drawingCompare.ts";

const USE_MOCK_API = ((import.meta.env?.VITE_USE_MOCK_API as string | undefined) ?? 'true') === 'true';

const DRAWING_COMPARE_ENDPOINT = ENDPOINTS.drawingCompare;
const GET_IMAGE_RECTS = ENDPOINTS.getImageRects;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function postJson<TBody extends object, TResponse>(path: string, body: TBody): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, body);
  return data;
}

async function postForm<TResponse>(path: string, formData: FormData, responseType:  AxiosRequestConfig["responseType"] = 'json'): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: responseType
  });
  return data;
}

export const drawingReviewApi = {

  async getImageRects(payload: GetImageRectsRequest): Promise<GetImageRectsResponse> {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(GET_IMAGE_RECTS, form)
  },

  async drawingReviewStart(payload: DrawingCompareRequest): Promise<DrawingCompareResponse> {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    form.append('combination', JSON.stringify(payload.combination));
    return postForm(DRAWING_COMPARE_ENDPOINT, form);
  },

  async drawingReviewEnd(payload: DrawingCompareRequest) {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(DRAWING_COMPARE_ENDPOINT, form, 'blob');
  },

}