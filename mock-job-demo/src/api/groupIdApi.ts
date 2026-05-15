import type { GroupIdRequest, GroupIdResponse } from "../types/groupId.ts";
import { http } from "./http.ts";
import { ENDPOINTS } from "./endpoints.ts";
import { AxiosRequestConfig } from "axios";

const GROUP_ID_ENDPOINT = ENDPOINTS.issueGroupId;

async function postForm<TResponse>(path: string, formData: FormData, responseType:  AxiosRequestConfig["responseType"] = 'json'): Promise<TResponse> {
  const { data } = await http.post<TResponse>(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: responseType
  });
  return data;
}

export const groupIdApi = async (payload: GroupIdRequest): Promise<GroupIdResponse> => {
  const form = new FormData();
  form.append('user', payload.user);
  form.append('epic', payload.epic);
  form.append('group_id', payload.group_id ?? '');
  form.append('group_status', payload.group_status ?? '');
  form.append('others', JSON.stringify(payload.others ?? {}));
  form.append('operations', JSON.stringify(payload.operations ?? []));
  return postForm(GROUP_ID_ENDPOINT, form);
}
