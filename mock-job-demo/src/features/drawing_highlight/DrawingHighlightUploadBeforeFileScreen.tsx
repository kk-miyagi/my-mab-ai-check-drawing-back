import React, { useState, ChangeEvent, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { OperationIssueRequest } from '../../types/upload.ts';
import { issueOperationIdApi } from '../../api/issueOperationIdApi.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import {
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Header } from '../../components/Header';
import { InputFile, UploadFileItem } from '../../components/InputFile';

const DEFAULT_EPIC = 'drawing-highlight';
const DEFAULT_OPERATION = 'upload-base';

export const DrawingHighlightUploadBeforeFileScreen: React.FC = () => {

  const navigate = useNavigate();
  const [baseImageFile, setBaseImageFile] = useState<File[]>([]);
  const [currentItem, setCurrentItem] = useState<UploadFileItem | null>(null);

  const [title, setTitle] = useState<string>("");
  const [modelName, setModelName] = useState<string>("");

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleModelNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setModelName(e.target.value);
  };

  const handleFilesChange = useCallback((files: File[]) => {
    setBaseImageFile(files);
  }, []);

  const handleCurrentItemChange = useCallback((item: UploadFileItem | null) => {
    setCurrentItem(item);
  }, []);

  const handleStart = async () => {
    // ローカルストレージの初期化
    const localStorageData: LocalStorageData = {
      user: 'demo-user',
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
      operationId: null,
      status: 'start'
    }
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));

    try {
      // オペレーションIDの発行
      const metaPayload: OperationIssueRequest = {
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: 'start',
      };
      const issueResult = await issueOperationIdApi(metaPayload);
      localStorageData.operationId = issueResult.operation_id
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));

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
        files: baseImageFile,
      };

      await uploadApi.uploadPair(requestPayload);
      localStorageData.status = 'end'
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
      navigate("/drawing-highlight-upload-after", { state: { baseImageFile }})
    } catch (e) {
      localStorageData.status = 'error'
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/drawing-highlight-upload-before")
    }
  }

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">差分ハイライト</Typography>
          <Typography variant="body1" color="text.secondary">
            修正前の図面を選択し、タイトルと機種名を入力して「次へ」ボタンを押してください。
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleStart}
              disabled={baseImageFile.length === 0}
            >
              次へ
            </Button>
          </Box>

          <InputFile
            onFilesChange={handleFilesChange}
            onCurrentItemChange={handleCurrentItemChange}
            rightPanel={
              currentItem ? (
                <Stack spacing={1.5}>
                  <TextField
                    label="タイトル"
                    value={title}
                    onChange={handleTitleChange}
                    fullWidth
                  />
                  <TextField
                    label="機種名"
                    value={modelName}
                    onChange={handleModelNameChange}
                    fullWidth
                  />
                </Stack>
              ) : null
            }
          />
        </Stack>
      </Container>
    </Box>
  )
}
