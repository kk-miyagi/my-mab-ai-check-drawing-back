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
import type { OperationIssueRequest, UploadPairRequest } from '../../types/uploadServer.ts';
import { issueOperationIdApi } from '../../api/issueOperationIdApi.ts';
import { InputFiles, UploadFileItem } from '../../components/InputFiles';

type UploadedFile = {
  id: string;
  file: File;
  url: string;
  isPdf: boolean;
};

const toUploadedFile = (item: UploadFileItem): UploadedFile => {
  return {
    id: item.id,
    file: item.file,
    url: item.previewUrl,
    isPdf: item.kind === 'pdf',
  };
};

type NavigateOptions = {
  user: string;
  epic: string;
  group_id: string;
  others: Record<string, any>;
  operations: { operation: string; operation_id: string; status: string }[];
  info: {
    operation_id: string;
    baseImageFile: File;
    compareImageFile: File;
    baseRects: Record<string, any>;
    targetRects: Record<string, any>;
    similarities: Record<string, any>;
  }[];
}

export const DrawingCompareUploadCompareFileScreen: React.FC = () => {

  const navigate = useNavigate();

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(null);

  const [baseImages, setBaseImages] = useState<File[]>([]);
  const [compareImages, setCompareImages] = useState<File[]>([]);

  const location = useLocation();
  const data = location.state;
  const uploadPayload = data.uploadPayload;
  const baseImageFile = data.baseImageFile[0];

  // アップロードするファイルの切り替え
  const handleInputItemsChange = (nextItems: UploadFileItem[]) => {
    const nextFiles = nextItems.map(toUploadedFile);
    setFiles(nextFiles);
  };

  // 現在選択されているファイルの切り替え
  const handleCurrentItemChange = useCallback((currentItem: UploadFileItem | null) => {
    setCurrentFile((prev) => {
      if (!currentItem) {
        return null;
      }
      if (prev?.id === currentItem.id) {
        return prev;
      }
      return toUploadedFile(currentItem);
    });
  }, []);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isPdf = files.some(f =>
    (f.file?.type === 'application/pdf')
    || (f.file?.name?.toLowerCase().endsWith('.pdf'))
    || Boolean(f.isPdf)
  );

  const handleStart = async () => {
    setIsLoading(true);

    const navigateOptions: NavigateOptions = {
      user: uploadPayload.user,
      epic: uploadPayload.epic,
      group_id: uploadPayload.group_id,
      others: uploadPayload.others,
      operations: [],
      info: []
    };

    try {
      let operationId: string = uploadPayload.operations[0].operation_id;
      let baseImage: File;
      let compareImage: File;
      let baseRects: {};
      let targetRects = {};
      let similarities = {};
      for (let i = 0; i < files.length; i++) {
        if (i > 0) {
          const operationIdPayload: OperationIssueRequest = {
            user: uploadPayload.user,
            epic: uploadPayload.epic,
            group_id: uploadPayload.group_id,
            group_status: uploadPayload.group_status,
            others: uploadPayload.others,
            operations: [{ operation: 'issue-operation-id', operation_id: '', status: 'start' }]
          };
          const operationIdResponse = await issueOperationIdApi(operationIdPayload);
          const opId = operationIdResponse.operations[i].operation_id
          if (!opId) {
            return
          }
          operationId = opId;
        }

        // ファイルのアップロード
        const baseUploadPayload = {
          user: uploadPayload.user,
          epic: uploadPayload.epic,
          group_id: uploadPayload.group_id,
          group_status: 'doing',
          others: uploadPayload.others,
          operations: [{operation: 'upload-base', operation_id: operationId, status: 'doing'}],
          number: 1,
          bf_file: baseImageFile,
          af_file: null
        };
        await uploadApi.uploadPair(baseUploadPayload);

        const requestPayload = {
          user: uploadPayload.user,
          epic: uploadPayload.epic,
          group_id: uploadPayload.group_id,
          group_status: 'doing',
          others: uploadPayload.others,
          operations: [{operation: 'upload-target', operation_id: operationId, status: 'doing'}],
          number: 1,
          bf_file: files[i].file,
          af_file: null
        };
        await uploadApi.uploadPair(requestPayload);

        // 座標と類似度計算
        const requestSimilarityPayload = {
          user: uploadPayload.user,
          epic: uploadPayload.epic,
          group_id: uploadPayload.group_id,
          group_status: 'doing',
          others: uploadPayload.others,
          operations: [{operation: 'image-similarity', operation_id: operationId, status: 'doing'}]
        }
        const res = await imageSimilarityApi.getImageSimilarity(requestSimilarityPayload);
        baseRects = res.base_rects
        targetRects = res.target_rects
        similarities = res.similarities

        if (Object.keys(baseRects).length === 0 && Object.keys(targetRects).length === 0) {
          const requestPayload  = {
            user: uploadPayload.user,
            epic: uploadPayload.epic,
            group_id: uploadPayload.group_id,
            group_status: 'doing',
            others: uploadPayload.others,
            operations: [{operation: 'batch-drawing-compare', operation_id: operationId, status: 'start'}],
            combinations: {}
          };
          await drawingCompareApi.drawingCompareStart(requestPayload)
          continue;
        }

        baseImage = baseImageFile;
        compareImage = files[i].file;

        if (isPdf) {
          const requestSimilarityPayloadEnd = {
            user: uploadPayload.user,
            epic: uploadPayload.epic,
            group_id: uploadPayload.group_id,
            group_status: 'doing',
            others: uploadPayload.others,
            operations: [{operation: 'image-similarity', operation_id: operationId, status: 'end'}]
          }
          const zipJpegFile = await imageSimilarityApi.getImageSimilarityEnd(requestSimilarityPayloadEnd)
          const zip = await JSZip.loadAsync(zipJpegFile);
          const baseImgFile = zip.file(/upload-base/)[0];
          const imgBaseBlob = await baseImgFile.async('blob');
          const targetImgFile = zip.file(/upload-target/)[0]
          const imgTargetBlob = await targetImgFile.async('blob');

          const baseName = baseImgFile.name.split("/").pop() || baseImgFile.name;
          const targetName = targetImgFile.name.split("/").pop() || targetImgFile.name;
          baseImage = new File([imgBaseBlob], baseName, { type: imgBaseBlob.type });
          compareImage = new File([imgTargetBlob], targetName, { type: imgTargetBlob.type });
        }
        navigateOptions.operations.push({ operation: 'batch-drawing-compare', operation_id: operationId, status: 'start' });
        navigateOptions.info.push({
          operation_id: operationId,
          baseImageFile: baseImage,
          compareImageFile: compareImage,
          baseRects: baseRects,
          targetRects: targetRects,
          similarities: similarities
        });
      }

      if (files.length === 1) {
        navigate("/");
      }
      navigate("/drawing-compare",  { state: { navigateOptions }});

    } catch (e) {
      window.alert("アップロードに失敗しました。再度アップロードしてください。")
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
              disabled={files.length === 0 || isLoading}
              startIcon={isLoading ? <Loader2 size={18} className="spin" /> : undefined}
            >
              {isLoading ? '読み込み中' : '次へ'}
            </Button>
          </Box>

          <InputFiles onItemsChange={handleInputItemsChange} onCurrentItemChange={handleCurrentItemChange} />
        </Stack>
      </Container>
    </Box>
  )
}
