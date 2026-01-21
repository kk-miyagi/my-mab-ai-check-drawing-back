import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCheckStatusPolling } from './useCheckStatusPolling';
import { localStorageKey } from '../../constants/localStorageKey';
import { createLabelApi } from '../../api/createLabelApi.ts';
export const CreateLabelProcessingScreen: React.FC = () => {
  const raw = window.localStorage.getItem(localStorageKey.default);
  const parsed = JSON.parse(raw);
  console.log("[処理中画面] ローカルストレージ: ", raw)

  useCheckStatusPolling({operationId: parsed.operationId, phase: parsed.phase, epic: parsed.lastEpic, operation: parsed.lastOperation,});

  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
    parsed.status = 'end'
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(parsed));
    (async () => {
      try {
        const res = await createLabelApi.createLabelEnd({
          user: 'demo-user',
          epic: parsed.lastEpic,
          operation: parsed.lastOperation,
          operation_id: parsed.operationId,
          status: 'end'
        });
        if (res) {
          navigate("/create-label-result")
        }
        // const data = await res
        // console.log(data)
      } catch (e) {
        console.log("エラー")
      }})();
    }, 10000);
    return () => clearTimeout(timer);
  });



  return (
    <div className="page">
      <h2>ラベル付与の処理中</h2>
      <p>現在ラベルを付与中です。<br />30分から1時間ほどかかりますのでしばらくお待ちください。</p>
    </div>

  );
};
