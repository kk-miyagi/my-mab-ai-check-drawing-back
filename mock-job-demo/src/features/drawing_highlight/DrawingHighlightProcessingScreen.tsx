import React from 'react'
import { useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { usePolling } from '../../hooks/usePolling.ts';
import { CheckStatusRequest } from '../../types/checkStatus.ts';
import { checkStatusApi } from '../../api/checkStatusApi.ts';

export const DrawingHighlightProcessingScreen: React.FC = () => {
  const raw = window.localStorage.getItem(localStorageKey.drawingHighlight) as string;
  const parsed = JSON.parse(raw);

  const navigate = useNavigate();
  const payload: CheckStatusRequest = {
    user: 'demo-user',
    epic: parsed.lastEpic,
    operation: parsed.lastOperation,
    operation_id: parsed.operationId,
    status: 'doing',
  };

  const handleEnd = () => {
    parsed.status = 'end'
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(parsed));
    navigate('/drawing-highlight-result')
  }

  const handleError = () => {
    window.alert("バッチ処理中にエラーが起こりました。画面を切り替えます")
    navigate('/')
  }

  usePolling(
    async () => {
      const res = await checkStatusApi.checkStatus(payload);
      return res;
    },
    (r) => r.status === 'end',
    () => handleEnd(),
    (r) => r.status === 'error',
    () => handleError(),
    3000
  );

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>図面ハイライトの処理中</h2>
      </div>
      <p>現在図面ハイライトの処理中です。<br />完了までしばらくお待ちください。</p>

    </div>

  );
};
