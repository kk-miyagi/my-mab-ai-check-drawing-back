// Helper for uploading file pairs. ID issuance is handled in issueOperationId.ts.
// Uses VITE_USE_MOCK_API (default true) to toggle between mock and real calls.

import { issueOperationId } from '../ustils/issueOperationId';
import { http } from '../ustils/http';
import type {
  OperationIssueRequest,
  OperationIssueResponse,
  UploadPairRequest,
  UploadCompleteRequest,
  UploadResponse,
} from '../types/uploadServer';

const USE_MOCK_API = ((import.meta.env?.VITE_USE_MOCK_API as string | undefined) ?? 'true') === 'true';

const FILE_UPLOAD_ENDPOINT = '/multi_fileupload/';

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
  issueOperationId,

  async uploadPair(payload: UploadPairRequest): Promise<UploadResponse> {
    if (USE_MOCK_API) {
      await wait(600);
      return { status: 'doing', number: payload.number, operation_id: payload.operation_id };
    }

    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('operation', payload.operation);
    form.append('operation_id', payload.operation_id);
    form.append('status', payload.status);
    form.append('number', String(payload.number));
    // Use explicit field names for before/after files
    payload.files.forEach((file, idx) => {
      const field = payload.file_field_keys?.[idx] ?? (idx === 0 ? 'bf_file' : idx === 1 ? 'af_file' : `file_${idx + 1}`);
      form.append(field, file);
    });

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
};

export type { OperationIssueRequest, OperationIssueResponse };
