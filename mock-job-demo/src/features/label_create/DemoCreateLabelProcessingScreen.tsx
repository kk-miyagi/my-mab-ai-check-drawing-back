import React from 'react';
import { useNavigate } from 'react-router-dom';
import { localStorageKey } from '../../constants/localStorageKey';
import { usePolling } from '../../hooks/usePolling.ts';
import { CheckStatusRequest } from '../../types/checkStatus.ts';
import { checkStatusApi } from '../../api/checkStatusApi.ts';

export const DemoCreateLabelProcessingScreen: React.FC = () => {
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

  const handleError = () => {
    window.alert("バッチ処理中にエラーが起こりました。画面を切り替えます")
    navigate('/demo-create-label')
  }

  usePolling(
    async () => {
      const res = await checkStatusApi.checkStatus(payload);
      return res;
    },
    (r) => r.status === 'end',
    () => navigate('/demo-create-label-result'),
    (r) => r.status === 'error',
    () => handleError(),
    3000,
    10000
  );

  return (
    <div className="page">
      <h2>(デモ)ラベル付与の処理中</h2>
      <p>現在ラベルを付与中です。<br />デモ版のため10秒ほどで画面が切り替わります。</p>
    </div>

  );
};
