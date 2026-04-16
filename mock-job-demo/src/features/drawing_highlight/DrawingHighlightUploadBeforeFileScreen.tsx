import React, { useState, ChangeEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
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

  const [title, setTitle] = useState<string>("");
  const [modelName, setModelName] = useState<string>("");

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleModelNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setModelName(e.target.value);
  };

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
    const localStorageData: LocalStorageData = {
      user: 'demo-user',
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
      operationId: null,
      status: 'start'
    }
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));

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
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));

      // アップロード
      localStorageData.status = 'doing'
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
      const requestPayload = {
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: localStorageData.status,
        number: 1,
        files: baseImageFile,
      };

      await uploadApi.uploadPair(requestPayload);
      localStorageData.status = 'end'
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
      navigate("/drawing-highlight-upload-after", { state: { baseImageFile }})
    } catch (e) {
      localStorageData.status = 'error'
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/drawing-highlight-upload-before")
    }
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

      {baseImagepreview && (
        <div>
          <p>タイトル</p>
          <input type="text" value={title} onChange={handleTitleChange} placeholder="タイトル"/>
          <p>機種名</p>
          <input type="text" value={modelName} onChange={handleModelNameChange} placeholder="機種名"/>
        </div>
      )}

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
