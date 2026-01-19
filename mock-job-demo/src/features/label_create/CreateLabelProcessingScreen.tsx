import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCheckStatusPolling } from './useCheckStatusPolling';

export const CreateLabelProcessingScreen: React.FC = () => {
  // const PERSIST_KEY = 'upload_state_v1';
  // const raw = window.localStorage.getItem(PERSIST_KEY);
  // const parsed = JSON.parse(raw);
  // console.log("!![処理中画面] ローカルストレージ: ", raw)

  // useCheckStatusPolling({
  //   operationId: parsed.operationId,
  //   phase: parsed.phase,
  //   epic: parsed.lastEpic,
  //   operation: parsed.lastOperation,
  // });

  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/create-label-result")
    }, 60000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="page">
      <h2>ラベル付与の処理中</h2>
      <p>現在ラベルを付与中です。<br />30分から1時間ほどかかりますのでしばらくお待ちください。</p>
    </div>

  );
};
