import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// import { useUpload } from '../../components/upload/UploadContext.tsx';
import { useEpicInit } from '../../hooks/useEpicInit';
import { createLabelApi } from '../../api/createLabelApi.ts';

import type { UploadResponse, OperationIssueRequest } from '../../types/uploadServer.ts';
// import type { PersistedState } from '../../types/uploadContext.ts';
// import type { UploadPhase, UploadResult, FailedUpload } from '../../types/uploadClient';
import type { PersistedState } from '../../types/uploadContext.ts';
import { issueOperationId } from '../../components/upload/issueOperationId.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import type { CreateLabelResponse } from '../../types/createLabel.ts';

const DEFAULT_EPIC = 'label-create';
const DEFAULT_OPERATION = 'image-upload-and-create-label';

export const CreateLabelScreen: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = React.useState<File[]>([]);
  const [preview, setPreview] = React.useState<string | null>(null);

  const handleSetFile = (e:React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setFile([selectedFile]);
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setFile([]);
      setPreview(null);
    }
  };

  const handleStart = async () => {
    console.log("[ファイルアップロード]")

    // ローカルストレージの初期化
    const PERSIST_KEY = 'upload_state_v1';
    const toPersist: PersistedState = {
      phase: 'idle',
      progress: 0,
      completedRequests: 0,
      totalRequests: 0,
      failedUploads: [],
      logs: [],
      operationId: null,
      resultData: null,
      lastEpic: null,
      lastOperation: null,
      status: 'start'
    }
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(toPersist));

    // ローカルストレージのステータスをdoingに変更
    toPersist.phase = 'issuing_id'
    toPersist.status = 'doing'
    toPersist.lastEpic = DEFAULT_EPIC
    toPersist.lastOperation = DEFAULT_OPERATION
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(toPersist));

    // オペレーションIDの発行
    const DEFAULT_USER = (import.meta.env?.VITE_UPLOAD_USER as string | undefined) ?? 'demo-user';
    const metaPayload: OperationIssueRequest = {
      user: DEFAULT_USER,
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
      operation_id: null,
      status: 'start',
    };
    const issueResult = await issueOperationId(metaPayload);
    toPersist.operationId = issueResult.operation_id
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(toPersist));

    // 画像のアップロード
    const requestPayload = {
      user: metaPayload.user,
      epic: metaPayload.epic,
      operation: metaPayload.operation,
      operation_id: issueResult.operation_id,
      status: toPersist.status,
      number: 1,
      files: file,
    };
    const response = await uploadApi.uploadPair(requestPayload);
    console.log("画像アップロード: ", response);


    const raw = window.localStorage.getItem(PERSIST_KEY);
    console.log("画像アップロード後のローカルストレージ: ", raw);

    // 実行中画面に切り替え
    navigate('/label-create-processing');

    // 最終的にローカルストレージをクリア(本来必要ないが、ここに入れている)
    // window.localStorage.removeItem(PERSIST_KEY);

    // バッチ処理実行
    toPersist.lastOperation = 'create-label-start'

    let res: CreateLabelResponse;
    res = await createLabelApi.createLabelStart({
      user: 'demo-user',
      epic: DEFAULT_EPIC,
      operation: 'create-label',
      operation_id: issueResult.operation_id,
      status: 'end',
    });

    console.log("バッチ処理: ", res)

    // const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    // await wait(60);

    // navigate('/');
  }

  
  const { sendEnd, error: initError } = useEpicInit(DEFAULT_EPIC);

  React.useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>ラベル付与</h1>
        <Link to="/hub" onClick={async (e) => {e.preventDefault();await sendEnd();navigate('/hub');}}>前に戻る</Link>
      </div>
      {initError && <p style={{ color: 'red' }}>初期化エラー: {initError}</p>}
      <p>ID発行 → アップロード → 最終確認の流れで送信します。</p>
      <ul>
        <li>想定: 1MB程度の画像を1枚送信</li>
        <li>毎リクエストに user / epic / operation / operation_id / status を付与</li>
        <li>ステータス: start (ID発行), doing (送信中), end (完了 or 再送指示)</li>
      </ul>
      <div style={{ display: 'grid', gap: 4, margin: '12px 0' }}>
        <div><strong>epic:</strong> {DEFAULT_EPIC}</div>
        <div><strong>operation:</strong> {DEFAULT_OPERATION}</div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept="image/*" onChange={handleSetFile} />
          </label>
        </div>
      </div>

      {preview && (
        <div style={{ marginBottom: '15px' }}>
          <img src={preview} alt='プレビュー' style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleStart}  disabled={file.length === 0}>処理開始</button>
      </div>

    </div>
  );
};
