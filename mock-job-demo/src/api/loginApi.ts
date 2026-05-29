import { http } from './http';
import { ENDPOINTS } from './endpoints';
import type { LoginRequest, LoginResponse } from '../types/login.ts';

export const loginApi = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const { data } = await http.post<LoginResponse>(ENDPOINTS.login, payload)
    return data;
  }
}
