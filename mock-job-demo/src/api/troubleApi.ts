import { http } from './http';
import { ENDPOINTS } from './endpoints';
import type { TroubleRequest, TroubleResponse } from '../types/trouble';

const TROUBLE_INIT_ENDPOINT = ENDPOINTS.troubleInit;
const TROUBLE_ENDPOINT = ENDPOINTS.trouble;

export const troubleApi = {
  async troubleInit(payload: TroubleRequest): Promise<TroubleResponse> {
    const { data } = await http.post<TroubleResponse>(TROUBLE_INIT_ENDPOINT, payload);
    return data;
  },

  async trouble(payload: TroubleRequest): Promise<TroubleResponse> {
    const { data } = await http.post<TroubleResponse>(TROUBLE_ENDPOINT, payload);
    return data;
  },
};
