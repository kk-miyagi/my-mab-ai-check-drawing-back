import React, { useState, ChangeEvent, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OperationIssueRequest, UploadPairRequest } from '../../types/uploadServer.ts';
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
import { groupIdApi } from '../../api/groupIdApi.ts';

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
    try {
      const groupIdPayload = {
        user: 'demo-user',
        epic: DEFAULT_EPIC,
        group_id: '',
        group_status: 'start',
        others: {},
        operations: [{ operation: '', operation_id: '', status: '' }],
      };
      const groupIdResponse = await groupIdApi(groupIdPayload);
      const groupId = groupIdResponse.group_id;

      const operationIdPayload: OperationIssueRequest = {
        user: 'demo-user',
        epic: DEFAULT_EPIC,
        group_id: groupId,
        group_status: 'start',
        others: {},
        operations: [{ operation: DEFAULT_OPERATION, operation_id: '', status: 'start' }]
      };
      const operationIdResponse = await issueOperationIdApi(operationIdPayload);
      const operationId = operationIdResponse.operations[0].operation_id;

      const uploadPayload: UploadPairRequest = {
        user: 'demo-user',
        epic: DEFAULT_EPIC,
        group_id: groupId,
        group_status: 'start',
        others: { title: title, modelName: modelName, fileName: baseImageFile[0].name },
        operations: [{ operation: DEFAULT_OPERATION, operation_id: operationId, status: 'doing' }],
        number: 1,
        bf_file: baseImageFile[0],
        af_file: null,
      };

      await uploadApi.uploadPair(uploadPayload);

      navigate("/drawing-highlight-upload-after", { state: { uploadPayload }})
    } catch (e) {
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/")
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
