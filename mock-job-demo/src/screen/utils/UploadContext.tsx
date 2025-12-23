import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadApi } from '../../sever_demo_api/uploadApi';
import { issueOperationId } from '../../ustils/issueOperationId';
import { runWithLimit } from '../../ustils/runWithLimit';
import type { UploadResponse, OperationIssueRequest } from '../../types/uploadServer';
import type { UploadPhase, UploadResult, FailedUpload } from '../../types/uploadClient';

interface StartOptions {
  epic?: string;
  operation?: string;
  allowedFileNames?: string[];
  isRetry?: boolean;
}

interface UploadContextType {
  phase: UploadPhase;
  progress: number;
  completedRequests: number;
  totalRequests: number;
  failedUploads: FailedUpload[];
  logs: string[];
  operationId: string | null;
  resultData: UploadResult | null;
  startUpload: (files: File[], options?: StartOptions) => Promise<void>;
  reset: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

const DEFAULT_USER = (import.meta.env?.VITE_UPLOAD_USER as string | undefined) ?? 'demo-user';
const DEFAULT_EPIC = (import.meta.env?.VITE_UPLOAD_EPIC as string | undefined) ?? 'drawing-comparison';
const DEFAULT_OPERATION = (import.meta.env?.VITE_UPLOAD_OPERATION as string | undefined) ?? 'multi-file-upload';
const CONCURRENCY = Number((import.meta.env?.VITE_UPLOAD_CONCURRENCY as string | undefined) ?? 3);
const RETRY_CONCURRENCY = Number((import.meta.env?.VITE_RETRY_UPLOAD_CONCURRENCY as string | undefined) ?? 1);

const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
};

export const UploadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [completedRequests, setCompletedRequests] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [lastEpic, setLastEpic] = useState<string | null>(null);
  const [resultData, setResultData] = useState<UploadResult | null>(null);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const startUpload = async (files: File[], options?: StartOptions) => {
    if (!files.length) return;

    const allowed = options?.allowedFileNames?.filter(Boolean);
    if (allowed && allowed.length > 0) {
      const invalid = files.filter((f) => !allowed.includes(f.name)).map((f) => f.name);
      if (invalid.length > 0) {
        console.warn('[upload] blocked files not in allowed list', { invalid, allowed });
        addLog(`❌ 許可されていないファイルがあります: ${invalid.join(', ')}`);
        return;
      }
    }

    try {
      const chosenEpic = options?.epic?.trim() || DEFAULT_EPIC;
      const chosenOperation = options?.operation?.trim() || DEFAULT_OPERATION;
      const reuseExisting = !!(options?.isRetry && operationId && lastEpic === chosenEpic);

      setPhase('issuing_id');
      setLogs([]);
      setProgress(0);
      setCompletedRequests(0);
      setTotalRequests(0);
      setFailedUploads([]);
      setResultData(null);
      if (!reuseExisting) setOperationId(null);
      navigate('/processing');

      const metaPayload: OperationIssueRequest = {
        user: DEFAULT_USER,
        epic: chosenEpic,
        operation: chosenOperation,
        operation_id: reuseExisting ? operationId : null,
        status: 'start',
      };

      const filePairs = chunkArray(files, 2);
      const totalRequests = filePairs.length;
      setTotalRequests(totalRequests);
      addLog(`準備完了: ${files.length}枚 (${totalRequests}リクエスト)`);

      let newOperationId = operationId;

      if (reuseExisting && newOperationId) {
        addLog(`既存IDを再利用: ${newOperationId}`);
        console.info('[upload] reuse existing operation id', { newOperationId, epic: chosenEpic });
      } else {
        addLog('Phase 1: ID発行要求...');
        console.info('[upload] issue operation id request', metaPayload);
        const issueResult = await issueOperationId(metaPayload);
        newOperationId = issueResult.operation_id ?? `op_${Date.now()}`;
        setOperationId(newOperationId);
        setLastEpic(chosenEpic);
        console.info('[upload] issue operation id response', issueResult);
        addLog(`✅ ID発行: ${newOperationId}`);
      }

      setPhase('uploading');
      let completed = 0;
      const failureMap = new Map<number, FailedUpload>();

      const recordFailure = (number: number, fileNames: string[], reason: string, files: File[]) => {
        const existing = failureMap.get(number);
        const mergedNames = Array.from(new Set([...(existing?.fileNames ?? []), ...fileNames]));
        const mergedFiles = [...(existing?.files ?? [])];
        files.forEach((f) => {
          if (!mergedFiles.find((m) => m.name === f.name && m.lastModified === f.lastModified)) {
            mergedFiles.push(f);
          }
        });
        failureMap.set(number, { number, fileNames: mergedNames, reason, files: mergedFiles });
      };

      const effectiveConcurrency = options?.isRetry ? RETRY_CONCURRENCY : CONCURRENCY;

      await runWithLimit<File[], UploadResponse>(
        filePairs,
        effectiveConcurrency,
        async (pair, index) => {
          const number = index + 1;
          const fileNames = pair.map((f) => f.name);
          addLog(`📤 #${number} 送信開始 (${pair.length}枚) [${fileNames.join(', ')}]`);
          console.info('[upload] sending...', { number, fileNames, count: pair.length });

          const requestPayload = {
            user: metaPayload.user,
            epic: metaPayload.epic,
            operation: metaPayload.operation,
            operation_id: newOperationId,
            status: 'doing' as const,
            number,
            files: pair,
            file_field_keys: chosenEpic === 'label-create' ? ['bf_file_csv', 'bf_file'] : undefined,
          };

          console.info('[upload] uploadPair request', requestPayload);

          try {
            const response = await uploadApi.uploadPair(requestPayload);

            console.info('[upload] uploadPair response', { number, response });

            if (response.status === 'end' && typeof response.number === 'number') {
              addLog(`再送指示: number=${response.number}${response.file_name ? ` file=${response.file_name}` : ''}`);
              recordFailure(response.number, response.file_name ? [response.file_name] : fileNames, response.message ?? 'サーバーから再送指示', pair);
            } else {
              addLog(`✅ #${number} 送信完了`);
            }

            return response;
          } catch (err: any) {
            const reason = err?.message ?? 'unknown error';
            recordFailure(number, fileNames, reason, pair);
            addLog(`❌ #${number} 失敗: ${reason}`);
            console.error('[upload] uploadPair error', { number, reason: err });
            return { status: 'error', number, message: reason } satisfies UploadResponse;
          } finally {
            completed++;
            setCompletedRequests(completed);
            const percent = Math.round((completed / totalRequests) * 100);
            setProgress(percent);
            console.info('[upload] progress', { completed, total: totalRequests, percent });
          }
        }
      );

      const aggregatedFailures = Array.from(failureMap.values());
      setFailedUploads(aggregatedFailures);

      setPhase('verifying');
      addLog('Phase 3: 最終確認...');
      console.info('[upload] completeUpload request', {
        user: metaPayload.user,
        epic: metaPayload.epic,
        operation: metaPayload.operation,
        operation_id: newOperationId,
        status: 'end',
        sum_number: totalRequests,
      });
      let completion: UploadResponse;
      try {
        completion = await uploadApi.completeUpload({
          user: metaPayload.user,
          epic: metaPayload.epic,
          operation: metaPayload.operation,
          operation_id: newOperationId,
          status: 'end',
          sum_number: totalRequests,
        });
        console.info('[upload] completeUpload response', completion);
      } catch (err: any) {
        const reason = err?.message ?? 'completeUpload failed';
        completion = { status: 'error', message: reason };
        addLog(`❌ 最終確認失敗: ${reason}`);
        console.error('[upload] completeUpload error', err);
      }

      const finalResult: UploadResult = {
        ...completion,
        operationId: newOperationId,
        sum_number: completion.sum_number ?? totalRequests,
        failedUploads: aggregatedFailures,
        totalRequests,
      };

      const hasFailures = aggregatedFailures.length > 0 || completion.status === 'error';

      setResultData(finalResult);
      setPhase(hasFailures ? 'error' : 'complete');
      setProgress(100);
      navigate('/result');
    } catch (error: any) {
      console.error(error);
      setPhase('error');
      addLog(`❌ Error: ${error?.message ?? 'unknown error'}`);
      if (operationId) setResultData({ status: 'error', operationId });
      navigate('/result');
    }
  };

  const reset = () => {
    setPhase('idle');
    setLogs([]);
    setProgress(0);
    setCompletedRequests(0);
    setTotalRequests(0);
    setOperationId(null);
    setResultData(null);
    navigate('/');
  };

  return (
    <UploadContext.Provider
      value={{
        phase,
        progress,
        completedRequests,
        totalRequests,
        failedUploads,
        logs,
        operationId,
        resultData,
        startUpload,
        reset,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error('useUpload must be used within UploadProvider');
  return context;
};
