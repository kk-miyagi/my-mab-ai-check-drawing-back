import React from 'react'
import { useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { usePolling } from '../../hooks/usePolling.ts';
import { CheckStatusRequest } from '../../types/checkStatus.ts';
import { checkStatusApi } from '../../api/checkStatusApi.ts';

export const DrawingCompareProcessingScreen: React.FC = () => {
  const raw = window.localStorage.getItem(localStorageKey.drawingCompare) as string;
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
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(parsed));
    navigate('/') // TODO: 変更必要
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
      <h2>図面比較の処理中</h2>
      <p>現在図面比較の画像類似度を計算中です。<br />完了までしばらくお待ちください。</p>
    </div>

  );
};
