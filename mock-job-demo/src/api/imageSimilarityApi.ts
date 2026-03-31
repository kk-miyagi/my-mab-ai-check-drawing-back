import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import { AxiosRequestConfig } from "axios";
import type { GetImageSimilarityRequest, GetImageSimilarityResponse } from "../types/imageSimilarity.ts";

const GET_IMAGE_SIMILARITY = ENDPOINTS.getImageSimilarity;

async function postForm<TResponse>(path: string, formData: FormData, responseType:  AxiosRequestConfig["responseType"] = 'json'): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: responseType
  });
  return data;
}

export const imageSimilarityApi = {

  async getImageSimilarity(payload: GetImageSimilarityRequest): Promise<GetImageSimilarityResponse> {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(GET_IMAGE_SIMILARITY, form)
  },

  async getImageSimilarityEnd(payload: GetImageSimilarityRequest) {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(GET_IMAGE_SIMILARITY, form, 'blob')
  },

}