import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import { AxiosRequestConfig } from "axios";
import type { GetImageSimilarityRequest, GetImageSimilarityResponse, DrawingCompareRequest, DrawingCompareResponse } from "../types/drawingCompare.ts";

const USE_MOCK_API = ((import.meta.env?.VITE_USE_MOCK_API as string | undefined) ?? 'true') === 'true';

const DRAWING_COMPARE_ENDPOINT = ENDPOINTS.drawingCompare;
const GET_IMAGE_SIMILARITY = ENDPOINTS.getImageSimilarity;

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

export const drawingCompareApi = {

  async getImageSimilarity(payload: GetImageSimilarityRequest): Promise<GetImageSimilarityResponse> {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    // return postForm(GET_IMAGE_SIMILARITY, form)
    return {
      user: payload.user,
      epic: payload.epic,
      operation: payload.operation,
      operation_id: payload.operation_id,
      status: 'end',

      base_rects: {
        "bf_1": [671, 921, 253, 177],
        "bf_2": [77, 711, 569, 385],
        "bf_3": [673, 709, 344, 203],
        "bf_4": [1039, 692, 355, 407],
        "bf_5": [705, 152, 720, 529],
        "bf_6": [80, 133, 614, 565],
      },
      target_rects: {
        "af_1": [2332, 4107, 603, 383],
        "af_2": [1222, 3917, 604, 381],
        "af_3": [3363, 3603, 1351, 769],
        "af_4": [2654, 3481, 364, 454],
        "af_5": [2257, 3470, 378, 508],
        "af_6": [1340, 3439, 682, 500],
        "af_7": [433, 3342, 903, 565],
        "af_8": [5117, 2031, 1306, 1650],
        "af_9": [5117, 2031, 484, 1187],
        "af_10": [3171, 1559, 2430, 1660],
        "af_11": [1076, 1493, 2092, 1820],
        "af_12": [1076, 1492, 436, 717],
        "af_13": [175, 768, 1336, 1441],
        "af_14": [3193, 364, 1764, 1136],
      },
      similarities: {
        "bf_1": {
          "af_1": 80,
          "af_2": 70,
          "af_3": 30,
        },
        "bf_2": {
          "af_1": 40,
          "af_4": 50,
          "af_10": 60,
        },
        "bf_3": {
          "af_10": 70,
          "af_11": 80,
          "af_12": 90,
        },
        "bf_4": {
          "af_5": 80,
          "af_6": 70,
          "af_7": 30,
        },
        "bf_5": {
          "af_9": 40,
          "af_10": 50,
          "af_11": 60,
        },
        "bf_6": {
          "af_3": 70,
          "af_4": 80,
          "af_5": 90,
        },
      }
    };

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