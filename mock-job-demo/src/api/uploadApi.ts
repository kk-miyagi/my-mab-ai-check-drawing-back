// Helper for uploading file pairs. ID issuance is handled in issueOperationId.ts.
// Uses VITE_USE_MOCK_API (default true) to toggle between mock and real calls.

import { issueOperationIdApi } from './issueOperationIdApi';
import { http } from './http';
import { ENDPOINTS } from './endpoints';
import type {
  OperationIssueRequest,
  OperationIssueResponse,
  UploadPairRequest,
  UploadCompleteRequest,
  UploadResponse,
  EpicInitRequest,
  EpicInitResponse,
} from '../types/uploadServer';

const USE_MOCK_API = ((import.meta.env?.VITE_USE_MOCK_API as string | undefined) ?? 'true') === 'true';

const FILE_UPLOAD_ENDPOINT = ENDPOINTS.fileUpload;
const EPIC_INIT_ENDPOINT = ENDPOINTS.epicInit;

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

export const uploadApi = {
  issueOperationIdApi,

  async uploadPair(payload: UploadPairRequest): Promise<UploadResponse> {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('group_id', payload.group_id);
    form.append('group_status', payload.group_status);
    form.append('others', JSON.stringify(payload.others));
    form.append('operations', JSON.stringify(payload.operations));
    form.append('number', payload.number.toString());
    if (payload.bf_file) {
      form.append('bf_file', payload.bf_file);
    }
    if (payload.af_file) {
      form.append('af_file', payload.af_file);
    }
    return postForm(FILE_UPLOAD_ENDPOINT, form);
  },

  async completeUpload(payload: UploadCompleteRequest): Promise<UploadResponse> {
    if (USE_MOCK_API) {
      await wait(400);
      return { status: 'end', sum_number: payload.sum_number, operation_id: payload.operation_id };
    }

    const { data } = await http.post<UploadResponse>(FILE_UPLOAD_ENDPOINT, payload);
    return data;
  },

  async epicInit(payload: EpicInitRequest): Promise<EpicInitResponse> {
    if (USE_MOCK_API) {
      await wait(200);
      return { status: payload.status, operation_id: payload.operation_id };
    }

    return postJson(EPIC_INIT_ENDPOINT, payload);
  },

};

export type { OperationIssueRequest, OperationIssueResponse };
