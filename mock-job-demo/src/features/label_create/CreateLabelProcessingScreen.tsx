import React from 'react';
import { useNavigate } from 'react-router-dom';
import { localStorageKey } from '../../constants/localStorageKey';
import { createLabelApi } from '../../api/createLabelApi.ts';
import { usePolling } from '../../hooks/usePolling.ts';
import { CheckStatusRequest } from '../../types/uploadServer.ts';
export const CreateLabelProcessingScreen: React.FC = () => {
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

  usePolling(
    async () => {
      const res = await createLabelApi.checkStatus(payload);
      return res;
    },
    (r) => r.status === 'end',
    () => navigate('/create-label-result'),
    3000,
    10000
  );

  return (
    <div className="page">
      <h2>ラベル付与の処理中</h2>
      <p>現在ラベルを付与中です。<br />30分から1時間ほどかかりますのでしばらくお待ちください。</p>
    </div>

  );
};
