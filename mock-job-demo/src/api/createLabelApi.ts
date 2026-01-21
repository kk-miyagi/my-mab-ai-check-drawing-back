import { http } from './http';
import { ENDPOINTS } from './endpoints';
import type { CreateLabelRequest, CreateLabelResponse, CheckStatusRequest, CheckStatusResponse } from '../types/createLabel';

const USE_MOCK_API = ((import.meta.env?.VITE_USE_MOCK_API as string | undefined) ?? 'true') === 'true';

const CREATELABEL_ENDPOINT = ENDPOINTS.createLabel;
const CHECK_STATUS_ENDPOINT = ENDPOINTS.checkStatus;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function postJson<TBody extends object, TResponse>(path: string, body: TBody): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, body);
  return data;
}

async function postForm<TResponse>(path: string, formData: FormData): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

async function postForm_2<TResponse>(path: string, formData: FormData): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob'
  });
  return data;
}

export const createLabelApi = {
  async createLabelStart(payload: CreateLabelRequest): Promise<CreateLabelResponse> {
    if (USE_MOCK_API) {
      await wait(400);
      return { user: "demo-user", epic: "test", operation: "test", operation_id: payload.operation_id, status: 'end', message: 'test' };
    }
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(CREATELABEL_ENDPOINT, form);
  },

  async createLabelEnd(payload: CreateLabelRequest) {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm_2(CREATELABEL_ENDPOINT, form);
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
