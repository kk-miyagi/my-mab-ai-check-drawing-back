import React, { useState, ChangeEvent, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import { drawingCompareApi } from '../../api/drawingCompareApi.ts';
import { imageSimilarityApi } from '../../api/imageSimilarityApi.ts';
import { drawingHighlightApi } from '../../api/drawingHighlightApi.ts';
import { PdfPreview } from '../../components/PdfPreview.tsx';
import JSZip from 'jszip';

const DEFAULT_EPIC = 'drawing-highlight';
const DEFAULT_OPERATION = 'upload-target';

export const DrawingHighlightUploadAfterFileScreen: React.FC = () => {

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
    const getLocalStorage = window.localStorage.getItem(localStorageKey.drawingHighlight)
    if (!getLocalStorage) {
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/drawing-highlight-upload-before")
      return
    }

    // ローカルストレージの値を変更
    const localStorageData: LocalStorageData  = JSON.parse(getLocalStorage);
    localStorageData.epic = DEFAULT_EPIC
    localStorageData.operation = DEFAULT_OPERATION
    localStorageData.status = 'start'
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));

    if (!localStorageData.operationId) {
      return
    }

    try {
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
        files: compareImageFile,
      };
      await uploadApi.uploadPair(requestPayload);
      localStorageData.status = 'end'
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
    } catch (e) {
      localStorageData.status = 'error'
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
      window.alert("アップロードに失敗しました。再度アップロードしてください。")
      navigate("/drawing-highlight-upload-before")
    }

    // ローカルストレージの値を変更
    localStorageData.operation = 'image-similarity'
    localStorageData.status = 'start'
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));

    // 座標と類似度計算
    localStorageData.status = 'doing'
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
    const requestSimilarityPayload = {
      user: localStorageData.user,
      epic: localStorageData.epic,
      operation: localStorageData.operation,
      operation_id: localStorageData.operationId,
      status: localStorageData.status,
    }
    const requestSimilarityPayloadEnd = {
      user: localStorageData.user,
      epic: localStorageData.epic,
      operation: localStorageData.operation,
      operation_id: localStorageData.operationId,
      status: 'end',
    }
    try {
      const res = await imageSimilarityApi.getImageSimilarity(requestSimilarityPayload)
      const baseRects = res.base_rects
      const targetRects = res.target_rects
      const similarities = res.similarities

      if (Object.keys(similarities).length === 0) {
        // 実行中画面に遷移して、対象のAPIを叩く
        navigate("/drawing-highlight-processing")
        const toPersist =JSON.parse(window.localStorage.getItem(localStorageKey.drawingHighlight) as string);
        localStorageData.operation = "drawing-highlight"
        localStorageData.status = "doing"
        window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
        const requestPayload  = {
          user: localStorageData.user,
          epic: localStorageData.epic,
          operation: localStorageData.operation,
          operation_id: localStorageData.operationId,
          status: localStorageData.status,
          combinations: {}
        };
        const res = drawingHighlightApi.DrawingHighligh(requestPayload)
        navigate("/drawing-highlight-result", { state: { res }})
      } else {
        if (isPdf) {
          const zipJpegFile = await imageSimilarityApi.getImageSimilarityEnd(requestSimilarityPayloadEnd)
          const zip = await JSZip.loadAsync(zipJpegFile);
          const baseImgFile = zip.file(/demo-user_drawing-highlight_upload-base/)[0]
          const imgBaseBlob = await baseImgFile.async('blob');
          const targetImgFile = zip.file(/demo-user_drawing-highlight_upload-target/)[0]
          const imgTargetBlob = await targetImgFile.async('blob');

          const baseImageFile = [new File([imgBaseBlob], baseImgFile.name.split("/").pop(), { type: imgBaseBlob.type })]
          const compareImageFile = [new File([imgTargetBlob], targetImgFile.name.split("/").pop(), { type: imgTargetBlob.type })]
          localStorageData.status = 'end'
          window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
          navigate("/drawing-highlight",  { state: { baseImageFile, compareImageFile, baseRects, targetRects, similarities }})
        } else {
          localStorageData.status = 'end'
          window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
          navigate("/drawing-highlight",  { state: { baseImageFile, compareImageFile, baseRects, targetRects, similarities }})
        }
      }
    } catch (e) {
      setIsLoading(false);
      localStorageData.status = 'error'
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
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
