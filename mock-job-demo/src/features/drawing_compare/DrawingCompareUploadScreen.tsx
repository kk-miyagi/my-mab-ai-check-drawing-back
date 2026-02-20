import React, { useState, ChangeEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { PersistedState } from '../../types/uploadContext.ts';
import { OperationIssueRequest } from '../../types/upload.ts';
import { issueOperationId } from '../../components/upload/issueOperationId.ts';
import { uploadApi } from '../../api/uploadApi.ts';

const DEFAULT_EPIC = 'drawing-compare';
const DEFAULT_OPERATION = 'upload';

export const DrawingCompareUploadScreen: React.FC = () => {

  const navigate = useNavigate();
  const [baseImageFile, setBaseImageFile] = useState<File[]>([]);
  const [baseImagepreview, setBaseImagePreview] = useState<string | null>(null);
  const [compareImageFile, setCompareImageFile] = useState<File[]>([]);
  const [compareImagepreview, setCompareImagePreview] = useState<string | null>(null);

  const [baseCsvFile, setBaseCsvFile] = useState<File[]>([]);
  const [compareCsvFile, setCompareCsvFile] = useState<File[]>([]);

  const handleSetBaseImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setBaseImageFile([selectedFile]);
      setBaseImagePreview(URL.createObjectURL(selectedFile));
    } else {
      setBaseImageFile([]);
      setBaseImagePreview(null);
    }
  };

  const handleSetCompareImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setCompareImageFile([selectedFile]);
      setCompareImagePreview(URL.createObjectURL(selectedFile));
    } else {
      setCompareImageFile([]);
      setCompareImagePreview(null);
    }
  };

  const handleSetBaseCsvFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setBaseCsvFile([selectedFile]);
    } else {
      setBaseCsvFile([]);
    }
  };

  const handleSetCompareCsvFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setCompareCsvFile([selectedFile]);
    } else {
      setCompareCsvFile([]);
    }
  };


  const handleStart = async () => {
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
      demoFlag: false
    }
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(toPersist));
    
    // ローカルストレージのステータスをdoingに変更
    toPersist.phase = 'issuing_id'
    toPersist.status = 'doing'
    toPersist.lastEpic = DEFAULT_EPIC
    toPersist.lastOperation = DEFAULT_OPERATION
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(toPersist));

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
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(toPersist));

    toPersist.status = 'doing'
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));

    // アップロード
    const imageFiles: File[] = [baseImageFile[0], compareImageFile[0]]
    const csvFiles: File[] = [baseCsvFile[0], compareCsvFile[0]]
    const requestPayload = {
      user: 'demo-user',
      epic: toPersist.lastEpic,
      operation: DEFAULT_OPERATION,
      operation_id: toPersist.operationId,
      status: toPersist.status,
      number: 1,
      files: imageFiles.concat(csvFiles),
    };
    console.log(requestPayload)
    // const response = await uploadApi.uploadPair(requestPayload);

    // ここで画像をサーバーに渡す。
    // サーバー側では、矩形領域の座標を特定して類似度を計算する
    // その類似度を受け取り、

  }

  useEffect(() => {
    return () => {
      if (baseImagepreview) {
        URL.revokeObjectURL(baseImagepreview);
      }
      if (compareImagepreview) {
        URL.revokeObjectURL(compareImagepreview);
      }
    };
  }, [baseImagepreview, compareImagepreview]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>図面比較</h1>
        <Link to="/hub">前に戻る</Link>
      </div>

      <h3>基準側ラベル付与済み図面</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept="image/*" onChange={handleSetBaseImageFile} />
          </label>
        </div>
      </div>

      {baseImagepreview && (
        <div style={{ marginBottom: '15px' }}>
          <img src={baseImagepreview} alt='プレビュー' style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />
        </div>
      )}

      <h3>基準側設計情報</h3>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept=".csv*" onChange={handleSetBaseCsvFile} />
          </label>
        </div>
      </div>

      <h3>比較側ラベル付与済み図面</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept="image/*" onChange={handleSetCompareImageFile} />
          </label>
        </div>
      </div>

      {compareImagepreview && (
        <div style={{ marginBottom: '15px' }}>
          <img src={compareImagepreview} alt='プレビュー' style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />
        </div>
      )}

      <h3>比較側設計情報</h3>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept=".csv*" onChange={handleSetCompareCsvFile} />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleStart} >処理開始</button>
      </div>

    </div>
  )
}
