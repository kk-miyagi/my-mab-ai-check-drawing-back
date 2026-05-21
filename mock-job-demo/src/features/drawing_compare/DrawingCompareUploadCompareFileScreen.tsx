import React, { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react';
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

export const DrawingCompareUploadCompareFileScreen: React.FC = () => {

  const navigate = useNavigate();

  const location = useLocation();
  const data = location.state;
  const uploadPayload = data.uploadPayload;
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

    try {
      const requestPayload = {
        user: uploadPayload.user,
        epic: uploadPayload.epic,
        group_id: uploadPayload.group_id,
        group_status: 'doing',
        others: uploadPayload.others,
        operations: [{operation: 'upload-target', operation_id: uploadPayload.operations[0].operation_id, status: 'doing'}],
        number: 1,
        bf_file: compareImageFile[0],
        af_file: null
      };
      await uploadApi.uploadPair(requestPayload);
    } catch (e) {
      window.alert("アップロードに失敗しました。再度アップロードしてください。")
      navigate("/")
    }

    // 座標と類似度計算
    const requestSimilarityPayload = {
      user: uploadPayload.user,
      epic: uploadPayload.epic,
      group_id: uploadPayload.group_id,
      group_status: 'doing',
      others: uploadPayload.others,
      operations: [{operation: 'image-similarity', operation_id: uploadPayload.operations[0].operation_id, status: 'doing'}]
    }
    const requestSimilarityPayloadEnd = {
      user: uploadPayload.user,
      epic: uploadPayload.epic,
      group_id: uploadPayload.group_id,
      group_status: 'doing',
      others: uploadPayload.others,
      operations: [{operation: 'image-similarity', operation_id: uploadPayload.operations[0].operation_id, status: 'end'}]
    }
    try {
      const res = await imageSimilarityApi.getImageSimilarity(requestSimilarityPayload)
      const baseRects = res.base_rects
      const targetRects = res.target_rects
      const similarities = res.similarities


      if (Object.keys(baseRects).length === 0 && Object.keys(targetRects).length === 0) {
        const requestPayload  = {
          user: uploadPayload.user,
          epic: uploadPayload.epic,
          group_id: uploadPayload.group_id,
          group_status: 'doing',
          others: uploadPayload.others,
          operations: [{operation: 'batch-drawing-compare', operation_id: uploadPayload.operations[0].operation_id, status: 'start'}],
          combinations: {}
        };
        await drawingCompareApi.drawingCompareStart(requestPayload)
        navigate("/")
        return
      }

      if (Object.keys(baseRects).length > 0 && Object.keys(targetRects).length === 0) {
        setIsLoading(false);
        window.alert("自社図面に矩形領域が無いようです。図面を確認して再度アップロードしてください。")
        navigate("/drawing-compare-upload-base")
        return
      }

      if (Object.keys(baseRects).length === 0 && Object.keys(targetRects).length > 0) {
        setIsLoading(false);
        window.alert("客先図面に矩形領域が無いようです。図面を確認して再度アップロードしてください。")
        navigate("/drawing-compare-upload-base")
        return
      }

      if (Object.keys(baseRects).length > 0 && Object.keys(targetRects).length > 0 && Object.keys(similarities).length === 0 ) {
        setIsLoading(false);
        window.alert("図面の類似度計算に失敗しました。")
        navigate("/drawing-compare-upload-base")
        return
      }

      if (isPdf) {
        const zipJpegFile = await imageSimilarityApi.getImageSimilarityEnd(requestSimilarityPayloadEnd)
        const zip = await JSZip.loadAsync(zipJpegFile);
        const baseImgFile = zip.file(/upload-base/)[0]
        const imgBaseBlob = await baseImgFile.async('blob');
        const targetImgFile = zip.file(/upload-target/)[0]
        const imgTargetBlob = await targetImgFile.async('blob');

        const baseImageFile = [new File([imgBaseBlob], baseImgFile.name.split("/").pop(), { type: imgBaseBlob.type })]
        const compareImageFile = [new File([imgTargetBlob], targetImgFile.name.split("/").pop(), { type: imgTargetBlob.type })]
        const requestPayload = {
          user: uploadPayload.user,
          epic: uploadPayload.epic,
          group_id: uploadPayload.group_id,
          group_status: 'doing',
          others: uploadPayload.others,
          operations: [{operation: 'batch-drawing-compare', operation_id: uploadPayload.operations[0].operation_id, status: 'start'}],
          combinations: {}
        };
        navigate("/drawing-compare",  { state: { requestPayload, baseImageFile, compareImageFile, baseRects, targetRects, similarities }})
      } else {
        const requestPayload = {
          user: uploadPayload.user,
          epic: uploadPayload.epic,
          group_id: uploadPayload.group_id,
          group_status: 'doing',
          others: uploadPayload.others,
          operations: [{operation: 'batch-drawing-compare', operation_id: uploadPayload.operations[0].operation_id, status: 'start'}],
          combinations: {}
        };
        navigate("/drawing-compare",  { state: { requestPayload, baseImageFile, compareImageFile, baseRects, targetRects, similarities }})
      }
    } catch (err) {
      setIsLoading(false);
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/")
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
