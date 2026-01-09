export type PersistedUploadState = {
  phase?: string;
  status?: 'start' | 'doing' | 'end' | 'error';
};

// 画面復帰に関する関数
export const derivePhase = (raw: string | null): string | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as PersistedUploadState;
    if (parsed.phase) return parsed.phase;
    if (parsed.status === 'start') return 'issuing_id';
    if (parsed.status === 'doing') return 'uploading';
    if (parsed.status === 'end') return 'complete';
    if (parsed.status === 'error') return 'error';
  } catch {
    /* noop */
  }
  return undefined;
};
