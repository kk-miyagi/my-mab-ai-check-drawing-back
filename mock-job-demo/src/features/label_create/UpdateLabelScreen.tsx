import React, { useEffect, useState, ChangeEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createLabelApi } from '../../api/createLabelApi.ts';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import type { CreateLabelResponse } from '../../types/createLabel.ts';
import Papa  from 'papaparse';
import { UploadPairRequest } from '../../types/uploadServer.ts';

const DEFAULT_EPIC = 'create-label';
const DEFAULT_OPERATION = 'batch-update-label';

type Row = Record<string, string | number | boolean | null>;

export const UpdateLabelScreen: React.FC = () => {
  const location = useLocation();
  const data = location.state;
  const currentImageFile = data.currentImageFile;

  const navigate = useNavigate();

  // image
  const [imageFile, setImageFile] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // csv
  const [csvFile, setCsvFile] = useState<File[]>([]);
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);

  // ローカルストレージの削除ボタン用
  const handleRemoveItem = () => {
    navigate('/hub')
  };

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
    // ローカルストレージの取得
    const getLocalStorage = window.localStorage.getItem(localStorageKey.createLabel);
    if (!getLocalStorage) {
      window.alert("処理に失敗したため、画面を切り替えます");
      navigate("/");
      return
    }
    const localStorageData: LocalStorageData = JSON.parse(getLocalStorage);
    localStorageData.epic = DEFAULT_EPIC
    localStorageData.operation = DEFAULT_OPERATION
    localStorageData.status = 'start'
    window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData))
  
    if (!localStorageData.operationId) {
      return
    }

    try {
      // 画像のアップロード
      const requestPayload: UploadPairRequest = {
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: 'doing',
        number: 1,
        files: imageFile.concat(csvFile),
      };
      await uploadApi.uploadPair(requestPayload);

      // 実行中画面に切り替え
      navigate('/update-label-processing');

      // バッチ処理実行
      let res: CreateLabelResponse;
      res = await createLabelApi.updateLabelStart({
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: localStorageData.status
      });
    } catch (e) {
      localStorageData.status = 'error';
      window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData));
      window.alert("バッチ処理起動に失敗したため、画面を切り替えます")
      navigate("/update-label")
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
      </div>
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
        <button className="primary" onClick={handleRemoveItem}>終了し、ホームに戻る</button>
        <button className="primary" onClick={handleStart} disabled={imageFile.length === 0 || csvFile.length === 0}>処理開始</button>
      </div>

    </div>
  );
};
