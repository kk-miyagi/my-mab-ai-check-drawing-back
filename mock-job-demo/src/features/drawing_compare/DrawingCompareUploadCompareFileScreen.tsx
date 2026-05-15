import React, { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import { drawingCompareApi } from '../../api/drawingCompareApi.ts';
import { imageSimilarityApi } from '../../api/imageSimilarityApi.ts';
import JSZip from 'jszip';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { Header } from '../../components/Header';
import { InputFile } from '../../components/InputFile';

const DEFAULT_EPIC = 'drawing-compare';
const DEFAULT_OPERATION = 'upload-target';

export const DrawingCompareUploadCompareFileScreen: React.FC = () => {

  const navigate = useNavigate();

  const location = useLocation();
  const data = location.state;
  const baseImageFile = data.baseImageFile;

  const [compareImageFile, setCompareImageFile] = useState<File[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleFilesChange = useCallback((files: File[]) => {
    setCompareImageFile(files);
  }, []);

  const isPdf = compareImageFile.length > 0
    && (compareImageFile[0].type === 'application/pdf'
      || compareImageFile[0].name.toLowerCase().endsWith('.pdf'));

  const handleStart = async () => {
    setIsLoading(true);
    // ローカルストレージの取得
    const getLocalStorage = window.localStorage.getItem(localStorageKey.drawingCompare)
    if (!getLocalStorage) {
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/drawing-compare-upload-base")
      return
    }

    // ローカルストレージの値を変更
    const localStorageData: LocalStorageData  = JSON.parse(getLocalStorage);
    localStorageData.epic = DEFAULT_EPIC
    localStorageData.operation = DEFAULT_OPERATION
    localStorageData.status = 'start'
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
   
    if (!localStorageData.operationId) {
      return
    }

    try {
      // アップロード
      localStorageData.status = 'doing'
      window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
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
      window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
    } catch (e) {
      localStorageData.status = 'error'
      window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
      window.alert("アップロードに失敗しました。再度アップロードしてください。")
      navigate("/drawing-compare-upload-base")
    }
    
    // ローカルストレージの値を変更
    localStorageData.operation = 'image-similarity'
    localStorageData.status = 'start'
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));

    // 座標と類似度計算
    localStorageData.status = 'doing'
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
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


      if (Object.keys(baseRects).length === 0 && Object.keys(targetRects).length === 0) {
        localStorageData.status = 'end'
        window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
        localStorageData.operation = 'batch-drawing-compare'
        localStorageData.status = 'start'
        window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
        navigate("/")
        const requestPayload  = {
          user: localStorageData.user,
          epic: localStorageData.epic,
          operation: localStorageData.operation,
          operation_id: localStorageData.operationId,
          status: localStorageData.status,
          combinations: {}
        };
        await drawingCompareApi.drawingCompareStart(requestPayload)
        localStorageData.status = 'end'
        window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
        return
      }

      if (Object.keys(baseRects).length > 0 && Object.keys(targetRects).length === 0) {
        setIsLoading(false);
        localStorageData.status = 'error'
        window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
        window.alert("自社図面に矩形領域が無いようです。図面を確認して再度アップロードしてください。")
        navigate("/drawing-compare-upload-base")
        return
      }

      if (Object.keys(baseRects).length === 0 && Object.keys(targetRects).length > 0) {
        setIsLoading(false);
        localStorageData.status = 'error'
        window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
        window.alert("客先図面に矩形領域が無いようです。図面を確認して再度アップロードしてください。")
        navigate("/drawing-compare-upload-base")
        return
      }

      if (Object.keys(baseRects).length > 0 && Object.keys(targetRects).length > 0 && Object.keys(similarities).length === 0 ) {
        setIsLoading(false);
        localStorageData.status = 'error'
        window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
        window.alert("図面の類似度計算に失敗しました。")
        navigate("/drawing-compare-upload-base")
        return
      }

      if (isPdf) {
        const zipJpegFile = await imageSimilarityApi.getImageSimilarityEnd(requestSimilarityPayloadEnd)
        const zip = await JSZip.loadAsync(zipJpegFile);
        const baseImgFile = zip.file(/demo-user_drawing-compare_upload-base/)[0]
        const imgBaseBlob = await baseImgFile.async('blob');
        const targetImgFile = zip.file(/demo-user_drawing-compare_upload-target/)[0]
        const imgTargetBlob = await targetImgFile.async('blob');

        const baseImageFile = [new File([imgBaseBlob], baseImgFile.name.split("/").pop(), { type: imgBaseBlob.type })]
        const compareImageFile = [new File([imgTargetBlob], targetImgFile.name.split("/").pop(), { type: imgTargetBlob.type })]
        localStorageData.status = 'end'
        window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
        navigate("/drawing-compare",  { state: { baseImageFile, compareImageFile, baseRects, targetRects, similarities }})
      } else {
        localStorageData.status = 'end'
        window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
        navigate("/drawing-compare",  { state: { baseImageFile, compareImageFile, baseRects, targetRects, similarities }})
      }
    } catch (err) {
      setIsLoading(false);
      localStorageData.status = 'error'
      window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(localStorageData));
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/drawing-compare-upload-base")
    }
  }

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">図面比較</Typography>
          <Typography variant="body1" color="text.secondary">
            比較側(自社)の図面図面を選択し、「次へ」ボタンを押してください。
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleStart}
              disabled={compareImageFile.length === 0 || isLoading}
              startIcon={isLoading ? <Loader2 size={18} className="spin" /> : undefined}
            >
              {isLoading ? '読み込み中' : '次へ'}
            </Button>
          </Box>

          <InputFile onFilesChange={handleFilesChange} />
        </Stack>
      </Container>
    </Box>
  )
}
