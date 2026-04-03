import React from 'react'
import { useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { usePolling } from '../../hooks/usePolling.ts';
import { CheckStatusRequest } from '../../types/checkStatus.ts';
import { checkStatusApi } from '../../api/checkStatusApi.ts';

export const DrawingCompareProcessingScreen: React.FC = () => {
  const navigate = useNavigate();

  const getLocalStorage = window.localStorage.getItem(localStorageKey.drawingCompare)
  if (!getLocalStorage) {
    window.alert("処理に失敗したため、画面を切り替えます")
    navigate("/drawing-compare-upload-base")
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
    localStorageData.status = 'end'
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
    navigate('/drawing-compare-result')
  }

  const handleError = () => {
    window.alert("バッチ処理中にエラーが起こりました。画面を切り替えます")
    localStorageData.status = 'error'
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
    navigate("/drawing-compare-upload-base")
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
        <h2>図面比較の処理中</h2>
      </div>
      <p>現在図面比較を処理中です。<br />完了までしばらくお待ちください。</p>

    </div>

  );
};
