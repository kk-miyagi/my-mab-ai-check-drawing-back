import { uploadApi } from '../sever_demo_api/uploadApi';
import { OperationIssueResponse, EpicInitResponse } from '../types/uploadServer';

const DEFAULT_USER = (import.meta.env?.VITE_UPLOAD_USER as string | undefined) ?? 'demo-user';
const INIT_OPERATION = 'init';

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
};

export const endEpicSession = async ({ epic, operationId, user, operation }: EndParams): Promise<EpicInitResponse> => {
  const chosenUser = user?.trim() || DEFAULT_USER;
  const chosenOp = operation?.trim() || INIT_OPERATION;
  return uploadApi.epicInit({
    user: chosenUser,
    epic,
    operation: chosenOp,
    operation_id: operationId,
    status: 'end',
  });
};
