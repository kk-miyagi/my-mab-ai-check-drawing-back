import { PersistedState } from "../types/uploadContext";

export const getRedirectUrl = (raw: string | null): string | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.demoFlag && parsed.lastEpic === 'create-label' && parsed.lastOperation === 'multi-file-upload' && parsed.status === 'doing') return '/create-label-processing'
    if (!parsed.demoFlag && parsed.lastEpic === 'create-label' && parsed.lastOperation === 'batch-create-label' && parsed.status === 'doing') return '/create-label-processing'
    if (!parsed.demoFlag && parsed.lastEpic === 'create-label' && parsed.lastOperation === 'batch-create-label' && parsed.status === 'end') return '/create-label-result'
    if (parsed.demoFlag && parsed.lastEpic === 'create-label' && parsed.lastOperation === 'multi-file-upload' && parsed.status === 'doing') return '/demo-create-label-processing'
    if (parsed.demoFlag && parsed.lastEpic === 'create-label' && parsed.lastOperation === 'batch-create-label' && parsed.status === 'doing') return '/demo-create-label-processing'
    if (parsed.demoFlag && parsed.lastEpic === 'create-label' && parsed.lastOperation === 'batch-create-label' && parsed.status === 'end') return '/demo-create-label-result'
  } catch {
    /* noop */
  }
  return undefined;
};
