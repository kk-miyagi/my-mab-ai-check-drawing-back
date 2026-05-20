import { http } from './http';
import { ENDPOINTS } from './endpoints';
import type { CreateLabelRequest, CreateLabelResponse, UpdateLabelInitRequest, UpdateLabelRequest, UpdateLabelResponse } from '../types/createLabel';

const CREATELABEL_ENDPOINT = ENDPOINTS.createLabel;
const UPDATELABEL_ENDPOINT = ENDPOINTS.updateLabel;
const UPDATE_LABEL_INIT_ENDPOINT = ENDPOINTS.updateLabelInit;

export const createLabelApi = {
  async createLabelStart(payload: CreateLabelRequest): Promise<CreateLabelResponse> {
    const { data } = await http.post<CreateLabelResponse>(CREATELABEL_ENDPOINT, payload);
    return data;
  },

  async createLabelEnd(payload: CreateLabelRequest): Promise<Blob> {
    const { data } = await http.post<Blob>(CREATELABEL_ENDPOINT, payload, { responseType: 'blob' });
    return data;
  },

  async updateLabelInit(payload: UpdateLabelInitRequest): Promise<Blob> {
    const { data } = await http.post<Blob>(UPDATE_LABEL_INIT_ENDPOINT, payload, { responseType: 'blob' });
    return data;
  },

  async updateLabelStart(payload: UpdateLabelRequest): Promise<UpdateLabelResponse> {
    const { data } = await http.post<UpdateLabelResponse>(UPDATELABEL_ENDPOINT, payload);
    return data;
  },

  async updateLabelEnd(payload: UpdateLabelRequest): Promise<Blob> {
    const { data } = await http.post<Blob>(UPDATELABEL_ENDPOINT, payload,  { responseType: 'blob' });
    return data;
  },

}
