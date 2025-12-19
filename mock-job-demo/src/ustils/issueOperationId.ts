// Common helper for issuing operation IDs (status: start)
// Uses VITE_USE_MOCK_API (default true) to return a mock response unless explicitly disabled.

import type { OperationIssueRequest, OperationIssueResponse } from '../types/uploadServer';
import { http } from './http';

const USE_MOCK_API = ((import.meta.env?.VITE_USE_MOCK_API as string | undefined) ?? 'true') === 'true';
const ISSUE_OPERATION_ENDPOINT = '/issue/operation_id/';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const issueOperationId = async (
  payload: OperationIssueRequest
): Promise<OperationIssueResponse> => {
  if (USE_MOCK_API) {
    await wait(300);
    return { operation_id: `op_${Date.now()}`, status: 'start' };
  }

  const { data } = await http.post<OperationIssueResponse>(ISSUE_OPERATION_ENDPOINT, payload);
  return data;
};
