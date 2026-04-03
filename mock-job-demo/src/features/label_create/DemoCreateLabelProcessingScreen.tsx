import React from 'react';
import { useNavigate } from 'react-router-dom';
import { localStorageKey } from '../../constants/localStorageKey';
import { LocalStorageData } from '../../types/storage.ts';
import { usePolling } from '../../hooks/usePolling.ts';
import { CheckStatusRequest } from '../../types/checkStatus.ts';
import { checkStatusApi } from '../../api/checkStatusApi.ts';

export const DemoCreateLabelProcessingScreen: React.FC = () => {
  const navigate = useNavigate();

  const getLocalStorage = window.localStorage.getItem(localStorageKey.demoCreateLabel);
  if (!getLocalStorage) {
    window.alert("処理に失敗したため、画面を切り替えます");
    navigate("/create-label");
    return
  }
  const localStorageData: LocalStorageData = JSON.parse(getLocalStorage);

  if (!localStorageData.operationId) {
    return
  }

  const payload: CheckStatusRequest = {
    user: localStorageData.user,
    epic: localStorageData.epic,
    operation: localStorageData.operation,
    operation_id: localStorageData.operationId,
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
