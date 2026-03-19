import React, { useState, ChangeEvent, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import { drawingCompareApi } from '../../api/drawingCompareApi.ts';
import { drawingHighlightApi } from '../../api/drawingHighlightApi.ts';

const DEFAULT_EPIC = 'drawing-highlight';
const DEFAULT_OPERATION = 'upload-target';

export const DrawingHighlightUploadAfterFileScreen: React.FC = () => {

  const navigate = useNavigate();

  const location = useLocation();
  const data = location.state;
  const baseImageFile = data.baseImageFile;

  const [compareImageFile, setCompareImageFile] = useState<File[]>([]);
  const [compareImagepreview, setCompareImagePreview] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const handleStart = async () => {
    setIsLoading(true);
    // ローカルストレージの取得
    const toPersist =JSON.parse(window.localStorage.getItem(localStorageKey.drawingHighlight) as string);
    toPersist.lastOperation = DEFAULT_OPERATION
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(toPersist));
    // アップロード
    const requestPayload = {
      user: 'demo-user',
      epic: toPersist.lastEpic,
      operation: DEFAULT_OPERATION,
      operation_id: toPersist.operationId,
      status: toPersist.status,
      number: 1,
      files: compareImageFile,
    };
    await uploadApi.uploadPair(requestPayload);

    toPersist.lastOperation = 'image-similarity'
    toPersist.status = 'doing'
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(toPersist));
    // 座標と類似度計算
    const requestSimilarityPayload = {
      user: 'demo-user',
      epic: toPersist.lastEpic,
      operation: toPersist.lastOperation,
      operation_id: toPersist.operationId,
      status: toPersist.status,
    }
    try {
      const res = await drawingCompareApi.getImageSimilarity(requestSimilarityPayload)
      const baseRects = res.base_rects
      const targetRects = res.target_rects
      const similarities = res.similarities

      if (Object.keys(similarities).length === 0) {
        // 実行中画面に遷移して、対象のAPIを叩く
        navigate("/drawing-highlight-processing")
        const toPersist =JSON.parse(window.localStorage.getItem(localStorageKey.drawingHighlight) as string);
        toPersist.lastOperation = "drawing-highlight"
        toPersist.status = "doing"
        window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(toPersist));
        const requestPayload  = {
          user: 'demo-user',
          epic: toPersist.lastEpic,
          operation: toPersist.lastOperation ,
          operation_id: toPersist.operationId,
          status: toPersist.status,
          combinations: {}
        };
        const res = drawingHighlightApi.DrawingHighligh(requestPayload)
        navigate("/drawing-highlight-result", { state: { res }})
      } else {
        navigate("/drawing-highlight",  { state: { baseImageFile, compareImageFile, baseRects, targetRects, similarities }})
      }
    } catch (err) {
      setIsLoading(false);
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/drawing-highlight-upload-before")
    }
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
        <h1>図面ハイライト</h1>
      </div>

      <h3>修正後の図面</h3>
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

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleStart} disabled={compareImageFile.length === 0 || isLoading}>
          {isLoading && (
            <Loader2 className="spin" size={18} />
          )}
          {isLoading ? '処理中...' : '処理開始'}
        </button>  
      </div>

    </div>
  )
}
