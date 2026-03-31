import React, { useState, ChangeEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { PersistedState } from '../../types/uploadContext.ts';
import { OperationIssueRequest } from '../../types/upload.ts';
import { issueOperationIdApi } from '../../api/issueOperationIdApi.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import { PdfPreview } from '../../components/PdfPreview.tsx';

const DEFAULT_EPIC = 'drawing-highlight';
const DEFAULT_OPERATION = 'upload-base';

export const DrawingHighlightUploadBeforeFileScreen: React.FC = () => {

  const navigate = useNavigate();
  const [baseImageFile, setBaseImageFile] = useState<File[]>([]);
  const [baseImagepreview, setBaseImagePreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState<boolean>(false);

  const handleSetBaseImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      if (selectedFile.type === 'application/pdf') {
        setIsPdf(true);
      } else {
        setIsPdf(false);
      }
      setBaseImageFile([selectedFile]);
      setBaseImagePreview(URL.createObjectURL(selectedFile));
    } else {
      setBaseImageFile([]);
      setBaseImagePreview(null);
      setIsPdf(false);
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
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(toPersist));
    
    // ローカルストレージのステータスをdoingに変更
    toPersist.phase = 'issuing_id'
    toPersist.status = 'doing'
    toPersist.lastEpic = DEFAULT_EPIC
    toPersist.lastOperation = DEFAULT_OPERATION
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(toPersist));

    // オペレーションIDの発行
    const DEFAULT_USER = (import.meta.env?.VITE_UPLOAD_USER as string | undefined) ?? 'demo-user';
    const metaPayload: OperationIssueRequest = {
      user: DEFAULT_USER,
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
      operation_id: null,
      status: 'start',
    };
    const issueResult = await issueOperationIdApi(metaPayload);
    toPersist.operationId = issueResult.operation_id
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(toPersist));

    toPersist.status = 'doing'
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(toPersist));

    // アップロード
    const requestPayload = {
      user: 'demo-user',
      epic: toPersist.lastEpic,
      operation: DEFAULT_OPERATION,
      operation_id: toPersist.operationId,
      status: toPersist.status,
      number: 1,
      files: baseImageFile,
    };

    await uploadApi.uploadPair(requestPayload);
    navigate("/drawing-highlight-upload-after", { state: { baseImageFile }})

  }

  useEffect(() => {
    return () => {
      if (baseImagepreview) {
        URL.revokeObjectURL(baseImagepreview);
      }
    };
  }, [baseImagepreview]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>図面ハイライト</h1>
        <Link to="/hub">前に戻る</Link>
      </div>

      <h3>修正前の図面</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept="image/*, application/pdf" onChange={handleSetBaseImageFile} />
          </label>
        </div>
      </div>

      {baseImagepreview && !isPdf && (
        <div style={{ marginBottom: '15px' }}>
          <img src={baseImagepreview} alt='プレビュー' style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />
        </div>
      )}
      {baseImagepreview && isPdf && (
        <PdfPreview preview={baseImagepreview} />
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleStart} disabled={baseImageFile.length === 0}>次に進む</button>
      </div>

    </div>
  )
}
