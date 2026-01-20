import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCheckStatusPolling } from './useCheckStatusPolling';
import { localStorageKey } from '../../constants/localStorageKey';
import { createLabelApi } from '../../api/createLabelApi.ts';
export const CreateLabelProcessingScreen: React.FC = () => {
  const raw = window.localStorage.getItem(localStorageKey.default);
  const parsed = JSON.parse(raw);
  console.log("[処理中画面] ローカルストレージ: ", raw)

  // useCheckStatusPolling({
  //   operationId: parsed.operationId,
  //   phase: parsed.phase,
  //   epic: parsed.lastEpic,
  //   operation: parsed.lastOperation,
  // });

  // const handleEnd

  // res = createLabelApi.createLabelStart({
  //     user: 'demo-user',
  //     epic: parsed.lastEpic,
  //     operation: parsed.lastOperation,
  //     operation_id: parsed.operationId,
  //     status: 'end'
  //   });

  const handleRemoveItem = () => {
      window.localStorage.removeItem(localStorageKey.default);
      console.log('削除しました。');
    };

  // const navigate = useNavigate();

  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     navigate("/create-label-result")
  //   }, 60000);
  //   return () => clearTimeout(timer);
  // }, [navigate]);

  return (
    <div className="page">
      <h2>ラベル付与の処理中</h2>
      <p>現在ラベルを付与中です。<br />30分から1時間ほどかかりますのでしばらくお待ちください。</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleRemoveItem}>ローカルストレージの削除</button>
      </div>
    </div>

  );
};
