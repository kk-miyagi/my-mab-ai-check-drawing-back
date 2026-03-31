import { http } from './http';
import { ENDPOINTS } from './endpoints';
import type { CreateLabelRequest, CreateLabelResponse } from '../types/createLabel';
import { AxiosRequestConfig } from "axios";

const USE_MOCK_API = ((import.meta.env?.VITE_USE_MOCK_API as string | undefined) ?? 'true') === 'true';

const CREATELABEL_ENDPOINT = ENDPOINTS.createLabel;
const DEMO_CREATELABEL_ENDPOINT = ENDPOINTS.demoCreateLabel;
const UPDATELABEL_ENDPOINT = ENDPOINTS.updateLabel;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function postForm<TResponse>(path: string, formData: FormData, responseType:  AxiosRequestConfig["responseType"] = 'json'): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: responseType
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
    return postForm(CREATELABEL_ENDPOINT, form, 'blob');
  },

  async updateLabelStart(payload: CreateLabelRequest): Promise<CreateLabelResponse> {
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
    return postForm(UPDATELABEL_ENDPOINT, form);
  },

  async updateLabelEnd(payload: CreateLabelRequest) {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(UPDATELABEL_ENDPOINT, form, 'blob');
  },

  async demoCreateLabelStart(payload: CreateLabelRequest): Promise<CreateLabelResponse> {
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
    return postForm(DEMO_CREATELABEL_ENDPOINT, form);
  },

  async demoCreateLabelEnd(payload: CreateLabelRequest) {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    return postForm(DEMO_CREATELABEL_ENDPOINT, form, 'blob');
  },

}
