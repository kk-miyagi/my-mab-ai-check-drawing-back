import { http } from './http';
import { ENDPOINTS } from './endpoints';
import type { StatusListRequest, StatusListResponse } from '../types/statusList';

export const statusListApi = {
  async getStatusList(payload: StatusListRequest): Promise<StatusListResponse[]> {
    const { data } = await http.post<StatusListResponse[]>(ENDPOINTS.statusList, payload);
    return data;
  },
}
