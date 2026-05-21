import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import type { GetImageSimilarityRequest, GetImageSimilarityResponse } from "../types/imageSimilarity.ts";

const GET_IMAGE_SIMILARITY = ENDPOINTS.getImageSimilarity;

export const imageSimilarityApi = {

  async getImageSimilarity(payload: GetImageSimilarityRequest): Promise<GetImageSimilarityResponse> {
    const { data } = await http.post<GetImageSimilarityResponse>(GET_IMAGE_SIMILARITY, payload);
    return data;
  },

  async getImageSimilarityEnd(payload: GetImageSimilarityRequest): Promise<Blob> {
    const { data } = await http.post<Blob>(GET_IMAGE_SIMILARITY, payload, { responseType: 'blob' });
    return data;
  },

}