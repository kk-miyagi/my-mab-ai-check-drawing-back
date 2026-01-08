import React from 'react';
import { useUpload } from './UploadContext';
import { useCheckStatusPolling } from '../../utils/useCheckStatusPolling';

export const ProcessingScreen: React.FC = () => {
  const { phase, progress, logs, operationId, completedRequests, totalRequests, lastEpic, lastOperation } = useUpload();

  useCheckStatusPolling({ operationId, phase, epic: lastEpic ?? undefined, operation: lastOperation ?? undefined });

  return (
    <div className="page center">
      <h2>処理中... ({phase})</h2>
      {operationId && <p>operation_id: {operationId}</p>}
      <div className="progress" aria-label="upload progress">
        <div className="bar" style={{ width: `${progress}%` }} />
      </div>
      <p>{progress}% 完了 ({completedRequests}/{totalRequests} リクエスト)</p>
    </div>
  );
};
