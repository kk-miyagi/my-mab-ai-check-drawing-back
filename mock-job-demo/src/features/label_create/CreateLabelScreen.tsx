import React, { useEffect, useState, ChangeEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createLabelApi } from '../../api/createLabelApi.ts';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import type { OperationIssueRequest, UploadPairRequest } from '../../types/uploadServer.ts';
import { issueOperationIdApi } from '../../api/issueOperationIdApi.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import type { CreateLabelResponse } from '../../types/createLabel.ts';
import { PdfPreview } from '../../components/PdfPreview.tsx';
import { ImagePreview } from '../../components/ImagePreview.tsx';

const DEFAULT_EPIC = 'create-label';
const DEFAULT_OPERATION = 'batch-create-label';

type ModelName = {
  name: string;
  modelName: string;
}

type UploadedFile = {
  file: File;
  url: string; // プレビュー用のBlob URL
  isPdf: boolean;
}

export const CreateLabelScreen: React.FC = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [modelNames, setModelNames] = useState<ModelName[]>([]);

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleModelNameChange = (e: ChangeEvent<HTMLInputElement>, name: string) => {
    const value = e.target.value;
    setModelNames((prev) => 
      prev.map((item) => item.name === name ? {...item, modelName: value} : item)
    )
  };


  const handleSetFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFiles: UploadedFile[] = Array.from(files).map((file) => ({
        file: file,
        url: URL.createObjectURL(file),
        isPdf: file.type === 'application/pdf' ? true : false,
      }));
      const modelName: ModelName[] = Array.from(files).map((file) => ({
        name: file.name,
        modelName: ""
      }));
      setFiles(selectedFiles)
      setCurrentFile(selectedFiles[0])
      setModelNames(modelName)
    } else {
      setFiles([])
      setCurrentFile(null)
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    // ローカルストレージの初期化
    const localStorageData: LocalStorageData = {
      user: 'demo-user',
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
      operationId: null,
      status: 'start'
    }
    window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData));

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
      window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData));

      // 画像のアップロード
      for (let i = 0; i < files.length; i++) {
        const file = [files[i].file]
        const requestPayload: UploadPairRequest = {
          user: localStorageData.user,
          epic: localStorageData.epic,
          operation: localStorageData.operation,
          operation_id: localStorageData.operationId,
          status: 'doing',
          number: i + 1,
          files: file
        };
        await uploadApi.uploadPair(requestPayload);
      }

      // 実行中画面に切り替え
      navigate('/create-label-processing');

      // バッチ処理実行
      let res: CreateLabelResponse;
      res = await createLabelApi.createLabelStart({
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: localStorageData.status
      });
    } catch (e) {
      setIsLoading(false);
      localStorageData.status = 'error';
      window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData));
      window.alert("バッチ処理起動に失敗したため、画面を切り替えます");
      navigate("/create-label");
    }
  }

  useEffect(() => {
    return () => {
      if (files.length > 0) {
        files.map((file) => (
          URL.revokeObjectURL(file.url)
        ))
      }
    };
  }, [files]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>ラベル付与</h1>
        <Link to="/hub">前に戻る</Link>
      </div>

      <ul>
        <li>ラベル付与を行いたい図面を1枚アップロードしてください。</li>
        <li>想定
          <ul>
            <li>図面に矩形領域線を追記。</li>
            <li>図面がPDFファイルもしくは画像形式ファイル(JPAGやPNGなど)</li>
          </ul>
        </li>
      </ul>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" multiple accept="image/*, application/pdf" onChange={handleSetFile} />
          </label>
        </div>
      </div>

    {files.length > 0 && currentFile && (
      <div>
        <p>タイトル</p>
        <input type="text" value={title} onChange={handleTitleChange} placeholder="タイトル"/>
        <p>機種名</p>
        <input type="text" value={modelNames.find(f => f.name === currentFile.file.name)?.modelName} onChange={e => handleModelNameChange(e, currentFile.file.name)} placeholder="機種名" />
      </div>
    )}

      <div style={{ display: 'flex', gap: 10, marginTop: '15px', marginBottom: '15px', overflow: 'auto'}}>
        {files.length > 0  && (
          files.map((file) => (
            <button key={file.file.name} onClick={() => setCurrentFile(file)} style={{
              opacity: file.url === currentFile?.url ? 1 : 0.4,
            }}>{file.file.name}</button>
          ))
        )}
      </div>

      {files.length > 0 && currentFile && currentFile.isPdf && (
        <PdfPreview preview={currentFile.url} />
      )}
      {files.length > 0 && currentFile && !currentFile.isPdf && (
        <ImagePreview  file={currentFile.file} url={currentFile.url} />
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleStart}  disabled={files.length === 0 || isLoading}>
          {isLoading && (
            <Loader2 className="spin" size={18} />
          )}
          {isLoading ? '処理中...' : '処理開始'}
        </button>
      </div>

    </div>
  );
};
