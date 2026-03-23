import React, { useState, ChangeEvent, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import { drawingCompareApi } from '../../api/drawingCompareApi.ts';
import { PdfPreview } from '../../components/PdfPreview.tsx';
import JSZip from 'jszip';

const DEFAULT_EPIC = 'drawing-compare';
const DEFAULT_OPERATION = 'upload-target';

export const DrawingCompareUploadCompareFileScreen: React.FC = () => {

  const navigate = useNavigate();

  const location = useLocation();
  const data = location.state;
  const baseImageFile = data.baseImageFile;

  const [compareImageFile, setCompareImageFile] = useState<File[]>([]);
  const [compareImagepreview, setCompareImagePreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSetCompareImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      if (selectedFile.type === 'application/pdf') {
        setIsPdf(true);
      } else {
        setIsPdf(false);
      }
      setCompareImageFile([selectedFile]);
      setCompareImagePreview(URL.createObjectURL(selectedFile));
    } else {
      setCompareImageFile([]);
      setCompareImagePreview(null);
      setIsPdf(false);
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    // ローカルストレージの取得
    const toPersist =JSON.parse(window.localStorage.getItem(localStorageKey.drawingCompare) as string);
    toPersist.lastOperation = DEFAULT_OPERATION
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(toPersist));
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
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(toPersist));
    // 座標と類似度計算
    const requestSimilarityPayload = {
      user: 'demo-user',
      epic: toPersist.lastEpic,
      operation: toPersist.lastOperation,
      operation_id: toPersist.operationId,
      status: toPersist.status,
    }
    const requestSimilarityPayloadEnd = {
      user: 'demo-user',
      epic: toPersist.lastEpic,
      operation: toPersist.lastOperation,
      operation_id: toPersist.operationId,
      status: 'end',
    }
    try {
      const res = await drawingCompareApi.getImageSimilarity(requestSimilarityPayload)
      const baseRects = res.base_rects
      const targetRects = res.target_rects
      const similarities = res.similarities
      if (isPdf) {
        const zipJpegFile = await drawingCompareApi.getImageSimilarityEnd(requestSimilarityPayloadEnd)
        const zip = await JSZip.loadAsync(zipJpegFile);
        const baseImgFile = zip.file(/demo-user_drawing-compare_upload-base/)[0]
        const imgBaseBlob = await baseImgFile.async('blob');
        const targetImgFile = zip.file(/demo-user_drawing-compare_upload-target/)[0]
        const imgTargetBlob = await targetImgFile.async('blob');

        const baseImageFile = [new File([imgBaseBlob], baseImgFile.name.split("/").pop(), { type: imgBaseBlob.type })]
        const compareImageFile = [new File([imgTargetBlob], targetImgFile.name.split("/").pop(), { type: imgTargetBlob.type })]
        navigate("/drawing-compare",  { state: { baseImageFile, compareImageFile, baseRects, targetRects, similarities }})
      } else {
        navigate("/drawing-compare",  { state: { baseImageFile, compareImageFile, baseRects, targetRects, similarities }})
      }
    } catch (err) {
      setIsLoading(false);
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/drawing-compare-upload-base")
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
        <h1>図面比較</h1>
      </div>

      <h3>比較側図面</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept="image/*, application/pdf" onChange={handleSetCompareImageFile} />
          </label>
        </div>
      </div>

      {compareImagepreview && !isPdf && (
        <div style={{ marginBottom: '15px' }}>
          <img src={compareImagepreview} alt='プレビュー' style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />
        </div>
      )}
      {compareImagepreview && isPdf && (
        <PdfPreview preview={compareImagepreview} />
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
