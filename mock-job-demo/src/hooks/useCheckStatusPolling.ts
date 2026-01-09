import React from 'react';
import { uploadApi } from '../api/uploadApi';
import type { CheckStatusRequest } from '../types/uploadServer';
import type { UploadPhase } from '../types/uploadClient';

const USE_POLL = ((import.meta.env?.VITE_ENABLE_CHECK_STATUS_POLL as string | undefined) ?? 'true') === 'true';
const POLL_INTERVAL_MS = Number((import.meta.env?.VITE_CHECK_STATUS_POLL_INTERVAL_MS as string | undefined) ?? 2000);

const DEFAULT_USER = (import.meta.env?.VITE_UPLOAD_USER as string | undefined) ?? 'demo-user';
const DEFAULT_EPIC = (import.meta.env?.VITE_UPLOAD_EPIC as string | undefined) ?? 'drawing-comparison';
const DEFAULT_OPERATION = (import.meta.env?.VITE_UPLOAD_OPERATION as string | undefined) ?? 'multi-file-upload';

const PERSIST_KEY = 'upload_state_v1';

type PersistedMeta = { lastEpic?: string | null; lastOperation?: string | null };

function getLastMetaFromPersist(): { epic?: string; operation?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedMeta;
    return {
      epic: parsed.lastEpic ?? undefined,
      operation: parsed.lastOperation ?? undefined,
    };
  } catch {
    return {};
  }
}

function getSafeIntervalMs(): number {
  if (!Number.isFinite(POLL_INTERVAL_MS)) return 2000;
  return Math.max(500, POLL_INTERVAL_MS);
}

export function useCheckStatusPolling(params: { operationId: string | null; phase: UploadPhase; epic: string | null; operation: string | null }): void {
  const { operationId, phase } = params;

  React.useEffect(() => {
    if (!USE_POLL) return;
    if (!operationId) return;
    if (phase === 'verifying') return;

    const meta = getLastMetaFromPersist();
    const epic = (params as any)?.epic ?? meta.epic ?? DEFAULT_EPIC;
    const operation = (params as any)?.operation ?? meta.operation ?? DEFAULT_OPERATION;
    const user = (params as any)?.user ?? DEFAULT_USER;
    const payload: CheckStatusRequest = {
      user,
      epic,
      operation,
      operation_id: operationId,
      status: 'doing',
    };

    let isCancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const res = await uploadApi.checkStatus(payload);
        if (isCancelled) return;

        if (res.status === 'end' || res.status === 'error') {
          if (timer !== undefined) window.clearInterval(timer);
        }
      } catch {
        // Intentionally ignore polling errors (e.g., server not tracking status)
      }
    };

    void tick();
    timer = window.setInterval(() => {
      void tick();
    }, getSafeIntervalMs());

    return () => {
      isCancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [operationId, phase, (params as any)?.user, (params as any)?.epic, (params as any)?.operation]);
}
