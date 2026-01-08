import { uploadApi } from '../api/uploadApi';
import { OperationIssueResponse, EpicInitResponse } from '../types/uploadServer';

const DEFAULT_USER = (import.meta.env?.VITE_UPLOAD_USER as string | undefined) ?? 'demo-user';
const INIT_OPERATION = 'init';

type InitResult = {
  operationId: string;
  issued: OperationIssueResponse;
  init?: EpicInitResponse;
};

// React 18 StrictMode runs effects twice in dev. Cache init per (user, epic, operation)
// so we don't issue multiple operation_ids for the same entry.
const initCache = new Map<string, Promise<InitResult>>();

const makeCacheKey = (user: string, epic: string, operation: string) => `${user}::${epic}::${operation}`;

type InitParams = {
  epic: string;
  user?: string;
  operation?: string;
};

type EndParams = {
  epic: string;
  operationId: string;
  user?: string;
  operation?: string;
};

export const initEpicSession = async ({ epic, user, operation }: InitParams): Promise<{ operationId: string; issued: OperationIssueResponse; init?: EpicInitResponse; }> => {
  const chosenUser = user?.trim() || DEFAULT_USER;
  const chosenOp = operation?.trim() || INIT_OPERATION;

  const cacheKey = makeCacheKey(chosenUser, epic, chosenOp);
  const existing = initCache.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<InitResult> => {
    const issued = await uploadApi.issueOperationId({
      user: chosenUser,
      epic,
      operation: chosenOp,
      operation_id: null,
      status: 'start',
    });

    const opId = issued.operation_id ?? `op_${Date.now()}`;

    const init = await uploadApi.epicInit({
      user: chosenUser,
      epic,
      operation: chosenOp,
      operation_id: opId,
      status: 'doing',
    });

    return { operationId: opId, issued, init };
  })();

  initCache.set(cacheKey, promise);
  try {
    return await promise;
  } catch (e) {
    initCache.delete(cacheKey);
    throw e;
  }
};

export const endEpicSession = async ({ epic, operationId, user, operation }: EndParams): Promise<EpicInitResponse> => {
  const chosenUser = user?.trim() || DEFAULT_USER;
  const chosenOp = operation?.trim() || INIT_OPERATION;
  const cacheKey = makeCacheKey(chosenUser, epic, chosenOp);
  try {
    return await uploadApi.epicInit({
      user: chosenUser,
      epic,
      operation: chosenOp,
      operation_id: operationId,
      status: 'end',
    });
  } finally {
    initCache.delete(cacheKey);
  }
};
