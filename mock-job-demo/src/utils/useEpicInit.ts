import React from 'react';
import { initEpicSession, endEpicSession } from '../utils/initEpic';
import type { EpicInitResponse } from '../types/uploadServer';

export const useEpicInit = (epic: string) => {
  const [operationId, setOperationId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        const { operationId: opId } = await initEpicSession({ epic });
        if (cancelled) return;
        setOperationId(opId);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'init failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [epic]);

  const sendEnd = React.useCallback(async (): Promise<EpicInitResponse | undefined> => {
    if (!operationId) return undefined;
    try {
      return await endEpicSession({ epic, operationId });
    } catch (e: any) {
      setError(e?.message ?? 'end failed');
      return undefined;
    }
  }, [epic, operationId]);

  return { operationId, loading, error, sendEnd };
};
