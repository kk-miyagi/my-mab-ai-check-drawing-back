import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import { AxiosRequestConfig } from "axios";
import type { CheckStatusRequest, CheckStatusResponse } from "../types/checkStatus";
import type { DrawingReviewRequest } from "../types/drawingReview.ts";

const USE_MOCK_API = ((import.meta.env?.VITE_USE_MOCK_API as string | undefined) ?? 'true') === 'true';

const DRAWING_REVIEW_ENDPOINT = ENDPOINTS.drawingReview;
const CHECK_STATUS_ENDPOINT = ENDPOINTS.checkStatus;

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

  async drawingReviewStart(payload: DrawingReviewRequest) {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(DRAWING_REVIEW_ENDPOINT, form);
  },

  async drawingReviewEnd(payload: DrawingReviewRequest) {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(DRAWING_REVIEW_ENDPOINT, form, 'blob');
  },

  async checkStatus(payload: CheckStatusRequest): Promise<CheckStatusResponse> {
      const normalize = (raw: any): CheckStatusResponse => {
        const base = {
          user: payload.user,
          epic: payload.epic,
          operation: payload.operation,
          operation_id: payload.operation_id,
        };

        if (raw && typeof raw === 'object') {
          const status = typeof raw.status === 'string' ? raw.status : undefined;
          const message = typeof raw.message === 'string' ? raw.message : undefined;

          if (status) {
            return {
              ...base,
              status,
              message: message ?? status,
            };
          }

          if (message) {
            return {
              ...base,
              status: message,
              message,
            };
          }
        }

        return {
          ...base,
          status: 'error',
          message: 'invalid response',
        };
      };

      if (!USE_MOCK_API) {
        // Even in mock mode, prefer the dedicated mock server (mockServer.js) for polling.
        try {
          const raw = await postJson<CheckStatusRequest, any>(CHECK_STATUS_ENDPOINT, payload);
          return normalize(raw);
        } catch {
          await wait(200);
          return {
            user: payload.user,
            epic: payload.epic,
            operation: payload.operation,
            operation_id: payload.operation_id,
            status: 'doing',
            message: 'doing',
          };
        }
      }

      const raw = await postJson<CheckStatusRequest, any>(CHECK_STATUS_ENDPOINT, payload);
      console.log("チェックステータスのraw: ", raw)
      return normalize(raw);
    },
}