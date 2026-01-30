import React from 'react';
import { useNavigate } from 'react-router-dom';
import { localStorageKey } from '../../constants/localStorageKey';
import { createLabelApi } from '../../api/createLabelApi.ts';
import { usePolling } from '../../hooks/usePolling.ts';
import { CheckStatusRequest } from '../../types/uploadServer.ts';

export const UpdateLabelProcessingScreen: React.FC = () => {
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
    navigate('/update-label-result')
  }

  const handleError = () => {
    window.alert("バッチ処理中にエラーが起こりました。画面を切り替えます")
    navigate('/update-label')
  }

  usePolling(
    async () => {
      const res = await createLabelApi.checkStatus(payload);
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
      <h2>ラベル付与の修正中</h2>
      <p>現在ラベルを修正しています。<br />完了までしばらくお待ちください。</p>
    </div>

  );
};
