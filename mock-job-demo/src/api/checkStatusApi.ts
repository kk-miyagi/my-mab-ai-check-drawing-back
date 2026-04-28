import type { AxiosRequestConfig } from 'axios';
import { http } from "./http";
import { ENDPOINTS } from "./endpoints";
import type { CheckStatusRequest, CheckStatusResponse } from "../types/checkStatus";

const CHECK_STATUS_ENDPOINT = ENDPOINTS.checkStatus;

async function postJson<TBody extends object, TResponse>(
  path: string,
  body: TBody,
  options?: AxiosRequestConfig
): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, body, options);
  return data;
}

export const checkStatusApi = {

  async checkStatus(payload: CheckStatusRequest, signal?: AbortSignal): Promise<CheckStatusResponse> {
    const form = new FormData();
    form.append('user', payload.user);
    form.append('epic', payload.epic);
    form.append('group_id', payload.group_id);
    form.append('group_status', payload.group_status);
    form.append('others', JSON.stringify(payload.others));
    form.append('operations', JSON.stringify(payload.operations));
    return postJson<CheckStatusRequest, CheckStatusResponse>(CHECK_STATUS_ENDPOINT, payload, signal ? { signal } : undefined);
  }
}
