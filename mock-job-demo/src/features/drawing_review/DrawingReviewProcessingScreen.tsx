import React from 'react'
import { useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { usePolling } from '../../hooks/usePolling.ts';
import { CheckStatusRequest } from '../../types/checkStatus.ts';
import { drawingReviewApi } from '../../api/drawingReviewApi.ts';

export const DrawingReviewProcessingScreen: React.FC = () => {
  const raw = window.localStorage.getItem(localStorageKey.default) as string;
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
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(parsed));
    navigate('/drawing-review-result')
  }

  const handleError = () => {
    window.alert("バッチ処理中にエラーが起こりました。画面を切り替えます")
    navigate('/')
  }

  usePolling(
    async () => {
      const res = await drawingReviewApi.checkStatus(payload);
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
      <h2>図面審査の処理中</h2>
      <p>現在図面審査の処理中です。<br />30分から1時間ほどかかりますのでしばらくお待ちください。</p>
    </div>

  );
};