import React, { useState, useEffect, useCallback } from 'react'
import { uploadApi } from '../../api/uploadApi.ts';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ImagePair, DrawingReviewResponse } from '../../types/drawingReview.ts';
import { drawingReviewApi } from '../../api/drawingReviewApi.ts';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { Header } from '../../components/Header';
import { InputFiles, UploadFileItem } from '../../components/InputFiles';
import { usePdfValidator } from '../../hooks/usePdfValidator.ts';
import { AlertPdf } from '../../components/AlertPdf.tsx';

type Row = Record<string, string | number | boolean | null>;

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

export const DrawingReviewScreen: React.FC = () => {

  const navigate = useNavigate();

  // アップロードしたExcelの中身
  const location = useLocation();
  const data = location.state;
  const uploadPayload = data.uploadPayload;

  // 「図面審査シート」に絞る
  const targetIndex = data.sheets.findIndex(sheet => sheet.name ==="図面審査シート");
  const targetSheet = data.sheets[targetIndex]

  const matchesCondition = (row: Row): boolean => {
    return row[6] === "可";
  };

  const filtered = targetSheet.rows.filter((row) => matchesCondition(row));

  const old_uniques = Array.from(
    new Set(
      filtered
        .map((r) => r[3])
    )
  );

  const new_uniques = Array.from(
    new Set(
      filtered
        .map((r) => r[7])
    )
  );

  const all_uniques = [...old_uniques, ...new_uniques]

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(null);

  const [validationMessage01, setValidationMessage01] = useState<string[]>([]);
  const [validationMessage02, setValidationMessage02] = useState<string[]>([]);
  const [validationMessage03, setValidationMessage03] = useState<string[]>([]);
  const [validationMessage04, setValidationMessage04] = useState<string[]>([]);

  const [pdfError, setPdfError] = useState<string[]>([]);

  const { allSinglePageFromFiles } = usePdfValidator();

  useEffect(() => {
    const run = async () => {
      const result = await allSinglePageFromFiles(files.map((f) => f.file));
        if (result.length > 0) {
          setPdfError(result);
        } else {
          setPdfError([]);
        }
    };
    run();
  }, [files, allSinglePageFromFiles]);

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

  const handleStart = async () => {
    try {
      // アップロード
      for (let i = 0; i < imagePairs.length; i++) {
        const files: File[] = [imagePairs[i].image1.file, imagePairs[i].image2.file]
        const requestPayload = {
          user: uploadPayload.user,
          epic: uploadPayload.epic,
          group_id: uploadPayload.group_id,
          group_status: 'doing',
          others: uploadPayload.others,
          operations: [{operation: 'upload-images', operation_id: uploadPayload.operations[0].operation_id, status: 'doing'}],
          number: i+1,
          bf_file: files[0],
          af_file: files[1],
        };
        await uploadApi.uploadPair(requestPayload);
      }

      const drawingReviewPayload: DrawingReviewResponse = {
          user: uploadPayload.user,
          epic: uploadPayload.epic,
          group_id: uploadPayload.group_id,
          group_status: 'doing',
          others: uploadPayload.others,
          operations: [{ operation: 'batch-drawing-review', operation_id: uploadPayload.operations[0].operation_id, status: 'start' }],
      }
      await drawingReviewApi.drawingReviewStart(drawingReviewPayload);
      await navigate("/")
    } catch (e) {
      await navigate("/");
    }
  }

  const [imagePairs, setImagePairs] = useState<ImagePair[]>([])

  const compareFileLists = (listA: string[], listB: string[]): void => { 
    setValidationMessage01([])   
    setValidationMessage02([])
    setValidationMessage03([])
    const listA01 = listA.filter(s => s.endsWith("-01"));
    const listA02 = listA.filter(s => s.endsWith("-02"));
    const listB01 = listB.filter(s => s.endsWith("-01"));
    const listB02 = listB.filter(s => s.endsWith("-02"));
    const setA = new Set(listA);
    const setA01 = new Set(listA01);
    const setA02 = new Set(listA02);
    const setB = new Set(listB);
    const setB01 = new Set(listB01);
    const setB02 = new Set(listB02);

    for (const name of setB01) {
      if (!setA01.has(name)) {
        setValidationMessage01(prev => [...prev, name])
      }
    }

    for (const name of setB02) {
      if (!setA02.has(name)) {
        setValidationMessage02(prev => [...prev, name])
      }
    }

    for (const name of setA) {
      if (!setB.has(name)) {
        setValidationMessage03(prev => [...prev, name])
      }
    }
  }

  // 新しく作成するロジック,画像がセットされた段階で動く
  // Excelのファイル名部分を抜き出す
  useEffect(() => {
    setImagePairs([])
    const fileNames = files.map(img => img.file.name.replace(/\.pdf$/i, ""));

    compareFileLists(fileNames, all_uniques)

    // ペアを作る
    const pairs: ImagePair[] = [];
    Object.keys(filtered).forEach((i) => {
      const image01 = files.find((row) => {
        const name = row.file.name.replace(/\.pdf$/i, "")
        return name === filtered[i][3]
      })
      const image02 = files.find((row) => {
        const name = row.file.name.replace(/\.pdf$/i, "")
        return name === filtered[i][7]
      })
      if (image01 && image02) {
        pairs.push({
          no: filtered[i][0],
          image1: image01,
          image2: image02
        })
      }
    })
    setImagePairs(pairs)
  }, [files])

  useEffect(() => {
    setValidationMessage04([])
    const fileNames = files.map(img => img.file.name);

    const uniqueNames = new Set(fileNames);

    if (uniqueNames.size !== fileNames.length) {
      const duplicates = fileNames.filter((item, index) => fileNames.indexOf(item) !== index);
      setValidationMessage04(duplicates)
    } else {
      setValidationMessage04([])
    }
  }, [files])

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">図面審査</Typography>
          <Typography variant="body1" color="text.secondary">
            アップロードした図面審査シートの中で「採用可否」が可である図面を全て選択し、「処理開始」ボタンを押してください。
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleStart}
              disabled={validationMessage01.length > 0 || validationMessage02.length > 0|| validationMessage03.length > 0 || validationMessage04.length > 0 || pdfError.length > 0}
            >
              処理開始
            </Button>
          </Box>

          {validationMessage01.length > 0 && (
            <Alert severity='error'>
              <AlertTitle>以下の指摘先図面を選択してください。</AlertTitle>
              <ul>{validationMessage01.map((i) => (<li>{i}</li>))}</ul>
            </Alert>
          )}

          {validationMessage02.length > 0 && (
            <Alert severity='error'>
              <AlertTitle>以下の指摘反映図面を選択してください。</AlertTitle>
              <ul>{validationMessage02.map((i) => (<li>{i}</li>))}</ul>
            </Alert>
          )}

          {validationMessage03.length > 0 && (
            <Alert severity='error'>
              <AlertTitle>以下の図面は不要であるため、選択から削除してください。</AlertTitle>
              <ul>{validationMessage03.map((i) => (<li>{i}</li>))}</ul>
            </Alert>
          )}

          {validationMessage04.length > 0 && (
            <Alert severity='error'>
              <AlertTitle>図面が重複しています。</AlertTitle>
              <ul>{validationMessage04.map((i) => (<li>{i}</li>))}</ul>
            </Alert>
          )}

          <AlertPdf pdfError={pdfError} />

          <InputFiles
            onItemsChange={handleInputItemsChange}
            onCurrentItemChange={handleCurrentItemChange}
          />
        </Stack>
      </Container>
    </Box>
  )
}
