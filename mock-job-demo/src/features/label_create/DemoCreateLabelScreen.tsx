import React, { useEffect, useState, ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createLabelApi } from '../../api/createLabelApi.ts';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import type { OperationIssueRequest, UploadPairRequest } from '../../types/uploadServer.ts';
import { issueOperationIdApi } from '../../api/issueOperationIdApi.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import type { CreateLabelResponse } from '../../types/createLabel.ts';

const DEFAULT_EPIC = 'create-label';
const DEFAULT_OPERATION = 'multi-file-upload';

export const DemoCreateLabelScreen: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

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
    // ローカルストレージの初期化
    const localStorageData: LocalStorageData = {
      user: 'demo-user',
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
      operationId: null,
      status: 'start'
    }
    window.localStorage.setItem(localStorageKey.demoCreateLabel, JSON.stringify(localStorageData));

    try {
      // オペレーションIDの発行
      const metaPayload: OperationIssueRequest = {
          user: localStorageData.user,
          epic: localStorageData.epic,
          operation: localStorageData.operation,
          operation_id: localStorageData.operationId,
          status: 'start',
      };
      const issueResult = await issueOperationIdApi(metaPayload);
      localStorageData.operationId = issueResult.operation_id
      window.localStorage.setItem(localStorageKey.demoCreateLabel, JSON.stringify(localStorageData));

      // 画像のアップロード
      const requestPayload: UploadPairRequest = {
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: 'doing',
        number: 1,
        files: file,
      };
      await uploadApi.uploadPair(requestPayload);

      // 実行中画面に切り替え
      navigate('/demo-create-label-processing');

      // バッチ処理実行
      localStorageData.operation = 'demo'
      window.localStorage.setItem(localStorageKey.demoCreateLabel, JSON.stringify(localStorageData))
      let res: CreateLabelResponse;
      res = await createLabelApi.demoCreateLabelStart({
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: 'start'
      });

      if (res.status === 'end') {
        localStorageData.status = res.status
        window.localStorage.setItem(localStorageKey.demoCreateLabel, JSON.stringify(localStorageData));
      }
    } catch (e) {
      localStorageData.status = 'error';
      window.localStorage.setItem(localStorageKey.demoCreateLabel, JSON.stringify(localStorageData));
      window.alert("バッチ処理起動に失敗したため、画面を切り替えます");
      navigate("/create-label");
    }
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
        <Link to="/hub">前に戻る</Link>
      </div>
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
