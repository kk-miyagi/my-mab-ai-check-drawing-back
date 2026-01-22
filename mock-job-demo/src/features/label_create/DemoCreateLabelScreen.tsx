import React, { useEffect, useState, ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEpicInit } from '../../hooks/useEpicInit';
import { createLabelApi } from '../../api/createLabelApi.ts';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import type { OperationIssueRequest } from '../../types/uploadServer.ts';
import type { PersistedState } from '../../types/uploadContext.ts';
import { issueOperationId } from '../../components/upload/issueOperationId.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import type { CreateLabelResponse } from '../../types/createLabel.ts';

const DEFAULT_EPIC = 'create-label';
const DEFAULT_OPERATION = 'multi-file-upload';

export const DemoCreateLabelScreen: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const { sendEnd, error: initError } = useEpicInit(DEFAULT_EPIC);

  const handleSetFile = (e: ChangeEvent<HTMLInputElement>) => {
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
      status: 'start',
      demoFlag: true
    }
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));

    // ローカルストレージのステータスをdoingに変更
    toPersist.phase = 'issuing_id'
    toPersist.status = 'doing'
    toPersist.lastEpic = DEFAULT_EPIC
    toPersist.lastOperation = DEFAULT_OPERATION
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));

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
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));

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
    toPersist.status = 'end'
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));
    console.log("[ラベル付与]画像アップロード_レスポンス ", response)
    console.log("[ラベル付与]画像アップロード_ローカルストレージ更新 ", JSON.parse(window.localStorage.getItem(localStorageKey.default) as string));


    toPersist.status = 'start'
    toPersist.lastOperation = 'batch-create-label'
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));
    console.log("[ラベル付与]バッチ処理_ローカルストレージ ", JSON.parse(window.localStorage.getItem(localStorageKey.default) as string));

    // 実行中画面に切り替え
    navigate('/demo-create-label-processing');

    // バッチ処理実行
    let res: CreateLabelResponse;
    res = await createLabelApi.demoCreateLabelStart({
      user: 'demo-user',
      epic: DEFAULT_EPIC,
      operation: toPersist.lastOperation,
      operation_id: issueResult.operation_id,
      status: toPersist.status,
    });
    if (res.status === 'end') {
      toPersist.status = res.status
      window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));
    }
    console.log("[ラベル付与]バッチ処理実行中_ローカルストレージ ", JSON.parse(window.localStorage.getItem(localStorageKey.default) as string));
  }

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>(デモ)ラベル付与</h1>
        <Link to="/hub" onClick={async (e) => {e.preventDefault();await sendEnd();navigate('/hub');}}>前に戻る</Link>
      </div>
      {initError && <p style={{ color: 'red' }}>初期化エラー: {initError}</p>}
      <ul>
        <li>ラベル付与を行いたい図面を1枚アップロードしてください。</li>
        <li>想定
          <ul>
            <li>図面に矩形領域線を追記。</li>
            <li>図面が画像形式ファイル(JPAGやPNGなど)。</li>
          </ul>
        </li>
      </ul>

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
