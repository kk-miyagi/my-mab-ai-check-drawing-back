export type PersistedState = {
  lastEpic?: string;
  lastOperation?: string;
  status?: 'start' | 'doing' | 'end' | 'error';
};

export const getRedirectUrl = (raw: string | null): string | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.lastEpic === 'create-label' && parsed.lastOperation === 'image-upload-and-create-label' && parsed.status === 'doing') return '/create-label-processing'
    if (parsed.lastEpic === 'create-label' && parsed.lastOperation === 'image-upload-and-create-label' && parsed.status === 'end') return '/create-label-result'
  } catch {
    /* noop */
  }
  return undefined;
};
