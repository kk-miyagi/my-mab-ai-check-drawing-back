import React from 'react';
import { useNavigate } from 'react-router-dom';
import { localStorageKey } from '../../constants/localStorageKey';
import { LocalStorageData } from '../../types/storage.ts';
import { usePolling } from '../../hooks/usePolling.ts';
import { CheckStatusRequest } from '../../types/checkStatus.ts';
import { checkStatusApi } from '../../api/checkStatusApi.ts';

export const UpdateLabelProcessingScreen: React.FC = () => {
  const navigate = useNavigate();

  const getLocalStorage = window.localStorage.getItem(localStorageKey.createLabel);
  if (!getLocalStorage) {
    window.alert("処理に失敗したため、画面を切り替えます");
    navigate("/update-label");
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

  const handleEnd = () => {
    localStorageData.status = 'end';
    window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData));
    navigate('/update-label-result')
  }

  const handleError = () => {
    localStorageData.status = 'error'
    window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData));
    window.alert("バッチ処理中にエラーが起こりました。画面を切り替えます")
    navigate('/update-label')
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
      <h2>ラベル付与の修正中</h2>
      <p>現在ラベルを修正しています。<br />完了までしばらくお待ちください。</p>
    </div>

  );
};
