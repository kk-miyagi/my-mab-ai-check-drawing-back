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
import Papa  from 'papaparse';

const DEFAULT_EPIC = 'create-label';
const DEFAULT_OPERATION = 'multi-file-upload';
type Row = Record<string, string | number | boolean | null>;

type Pair = {
  id: string;
  csv?: File;
  image?: File;
};


export const CreateLabelReUploadScreen: React.FC = () => {
  const navigate = useNavigate();
  const { sendEnd, error: initError } = useEpicInit(DEFAULT_EPIC);

  // image
  const [imageFile, setImageFile] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // csv
  const [csvFile, setCsvFile] = useState<File[]>([]);
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);

  const [mergedFiles, setMergedFiles] = useState<File[]>([]);


  const handleSetFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setImageFile([selectedFile]);
      setImagePreview(URL.createObjectURL(selectedFile));
    } else {
      setImageFile([]);
      setImagePreview(null);
    }
  };

  const handleSetCsvFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      
      const selectedFile = files[0];
      const text = await selectedFile.text()
      console.log(selectedFile.text())
      const result = Papa.parse<Row>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });
      const data = result.data ?? [];
      setCsvRows(data);
      setCsvColumns(data.length ? Object.keys(data[0]) : []);
      setCsvFile([selectedFile]);
    } else {
      setCsvFile([]);
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
      demoFlag: false
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
      files: imageFile.concat(csvFile),
    };

    const response = await uploadApi.uploadPair(requestPayload);
    toPersist.status = 'end'
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));
    console.log("[ラベル付与]画像アップロード_レスポンス ", response)
    console.log("[ラベル付与]画像アップロード_ローカルストレージ更新 ", JSON.parse(window.localStorage.getItem(localStorageKey.default) as string));


    toPersist.status = 'start'
    toPersist.lastOperation = 'batch-update-label'
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));
    console.log("[ラベル付与]バッチ処理_ローカルストレージ ", JSON.parse(window.localStorage.getItem(localStorageKey.default) as string));

    // 実行中画面に切り替え
    navigate('/create-label-processing');

    // バッチ処理実行
    let res: CreateLabelResponse;
    try {
      res = await createLabelApi.createLabelStart({
        user: 'demo-user',
        epic: DEFAULT_EPIC,
        operation: toPersist.lastOperation,
        operation_id: issueResult.operation_id,
        status: toPersist.status,
      });
      if (res.status === 'end' || res.status === 'doing') {
        toPersist.status = res.status
        window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));
      }
      console.log("[ラベル付与]バッチ処理実行中_ローカルストレージ ", JSON.parse(window.localStorage.getItem(localStorageKey.default) as string));

    } catch (err) {
      window.alert("バッチ処理起動に失敗したため、画面を切り替えます")
      navigate("/create-label-re-upload")
    }
  }

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>ラベル付与_修正内容反映後用</h1>
        <Link to="/hub" onClick={async (e) => {e.preventDefault();await sendEnd();navigate('/hub');}}>前に戻る</Link>
      </div>
      {initError && <p style={{ color: 'red' }}>初期化エラー: {initError}</p>}
      <ul>
        <li>修正内容を反映した図面とCSVをそれぞれ1枚ずつアップロードしてください。</li>
        <li>想定
          <ul>
            <li>CSVは.csvの拡張子であること</li>
            <li>図面が画像形式ファイル(JPAGやPNGなど)。</li>
          </ul>
        </li>
      </ul>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <span>画像ファイル</span>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept="image/*" onChange={handleSetFile} />
          </label>
          <span>CSVファイル</span>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept=".csv" onChange={handleSetCsvFile} />
          </label>
        </div>
      </div>

      <h3>プレビュー</h3>

      {imagePreview && (
        <div style={{ marginBottom: '15px' }}>
          <img src={imagePreview} alt='プレビュー' style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />
        </div>
      )}

      <div className='table-wrapper'>
        <table>
          <thead>
            <tr>{csvColumns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody className='table-row'>
            {csvRows.map((r, i) => (
              <tr key={i}>
                {csvColumns.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleStart} disabled={imageFile.length === 0}>処理開始</button>
      </div>

    </div>
  );
};
