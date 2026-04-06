export type LocalStorageData = {
  user: string;
  epic: string;
  operation: string;
  operationId: string | null;
  status: 'start' | 'doing' | 'end' | 'error';
};
