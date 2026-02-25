import React, { useState, ChangeEvent, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { uploadApi } from '../../api/uploadApi.ts';

const DEFAULT_EPIC = 'drawing-compare';
const DEFAULT_OPERATION = 'upload-compare';

export const DrawingCompareUploadCompareFileScreen: React.FC = () => {

  const navigate = useNavigate();

  const location = useLocation();
  const data = location.state;
  const baseImageFile = data.baseImageFile;

  const [compareImageFile, setCompareImageFile] = useState<File[]>([]);
  const [compareImagepreview, setCompareImagePreview] = useState<string | null>(null);
  const [compareCsvFile, setCompareCsvFile] = useState<File[]>([]);

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
    // ローカルストレージの取得
    const toPersist =JSON.parse(window.localStorage.getItem(localStorageKey.default) as string);
    toPersist.lastOperation = DEFAULT_OPERATION
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));
    // アップロード
    const requestPayload = {
      user: 'demo-user',
      epic: toPersist.lastEpic,
      operation: DEFAULT_OPERATION,
      operation_id: toPersist.operationId,
      status: toPersist.status,
      number: 1,
      files: compareImageFile.concat(compareCsvFile),
    };
    const response = await uploadApi.uploadPair(requestPayload);
    navigate("/drawing-compare",  { state: { baseImageFile, compareImageFile }})

    // ここで画像をサーバーに渡す。
    // サーバー側では、矩形領域の座標を特定して類似度を計算する
    // その類似度を受け取り、

  }

  useEffect(() => {
    return () => {
      if (compareImagepreview) {
        URL.revokeObjectURL(compareImagepreview);
      }
    };
  }, [compareImagepreview]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>図面比較</h1>
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
