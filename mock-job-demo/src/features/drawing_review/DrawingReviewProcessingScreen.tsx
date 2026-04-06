import React from 'react'
import { useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { usePolling } from '../../hooks/usePolling.ts';
import { CheckStatusRequest } from '../../types/checkStatus.ts';
import { checkStatusApi } from '../../api/checkStatusApi.ts';
import { LocalStorageData } from '../../types/storage.ts';

export const DrawingReviewProcessingScreen: React.FC = () => {
  const navigate = useNavigate();

  const getLocalStorage = window.localStorage.getItem(localStorageKey.drawingReview);
  if (!getLocalStorage) {
    window.alert("処理に失敗したため、画面を切り替えます");
    navigate("/drawing-review-upload-excel");
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
    window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));
    navigate('/drawing-review-result')
  }

  const handleError = () => {
    localStorageData.status = 'error'
    window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));
    window.alert("バッチ処理中にエラーが起こりました。画面を切り替えます")
    navigate('/drawing-review-upload-excel')
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
      <h2>図面審査の処理中</h2>
      <p>現在図面審査の処理中です。<br />完了までしばらくお待ちください。</p>
    </div>

  );
};