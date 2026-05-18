import React, { ChangeEvent, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { createLabelApi } from '../../api/createLabelApi.ts';
import type { OperationIssueRequest, UploadPairRequest } from '../../types/uploadServer.ts';
import { issueOperationIdApi } from '../../api/issueOperationIdApi.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import type { CreateLabelRequest, NavigateState } from '../../types/createLabel.ts';
import {
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { Header } from '../../components/Header';
import { groupIdApi } from '../../api/groupIdApi.ts';
import { InputFiles, UploadFileItem } from '../../components/InputFiles';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageDataV2 } from '../../types/storage.ts';
import { useLocalStorageArray } from '../../hooks/useLocalStorageArray.ts';

const DEFAULT_EPIC = 'create-label';
const DEFAULT_OPERATION = 'batch-create-label';

type ModelName = {
  id: string;
  modelName: string;
};

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

export const CreateLabelScreen: React.FC = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // ローディング状態の管理(これがないと一連の処理が完了する前に再度ボタンを押せてしまう)

  const [title, setTitle] = useState<string>(''); // タイトルの状態管理(タイトルは1回の処理で全てのファイルに対して共通の値とするため、currentFileから切り離して管理する)
  const [modelNames, setModelNames] = useState<ModelName[]>([]); // 機種名の状態管理(機種名はファイルごとに異なる値となるため、currentFileから切り離して管理する。modelNamesはファイルIDと機種名のペアの配列で管理する)

  // ローカルストレージの操作関数
  const { addItem } = useLocalStorageArray<LocalStorageDataV2>(localStorageKey.createLabel);

  // タイトルの切り替え
  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  // 機種名の切り替え
  const handleModelNameChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, id: string) => {
    const value = e.target.value;
    setModelNames((prev) =>
      prev.map((item) => (item.id === id ? { ...item, modelName: value } : item))
    );
  };

  // アップロードするファイルの切り替え
  const handleInputItemsChange = (nextItems: UploadFileItem[]) => {
    const nextFiles = nextItems.map(toUploadedFile);
    setFiles(nextFiles);

    const modelNameMap = new Map(modelNames.map((item) => [item.id, item.modelName]));
    setModelNames(
      nextFiles.map((item) => ({
        id: item.id,
        modelName: modelNameMap.get(item.id) ?? '',
      }))
    );
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


  // 現在選択されているファイルの機種名を取得
  const currentModelName = useMemo(() => {
    if (!currentFile) {
      return '';
    }
    return modelNames.find((item) => item.id === currentFile.id)?.modelName ?? '';
  }, [currentFile, modelNames]);

  // ラベル付与開始ボタンの処理
  const handleStart = async () => {
    setIsLoading(true);
    const modelNameMap = new Map(modelNames.map((item) => [item.id, item.modelName]));
    const requests: NavigateState[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const groupIdPayload = {
          user: 'demo-user',
          epic: DEFAULT_EPIC,
          group_id: 'new',
          group_status: 'start',
          others: null,
          operations: null,
        };
        const groupIdResponse = await groupIdApi(groupIdPayload);
        const groupId = groupIdResponse.group_id;

        const operationIdPayload: OperationIssueRequest = {
          user: 'demo-user',
          epic: DEFAULT_EPIC,
          group_id: groupId,
          group_status: 'start',
          others: null,
          operations: [{ operation: DEFAULT_OPERATION, operation_id: null, status: 'start' }]
        };
        const operationIdResponse = await issueOperationIdApi(operationIdPayload);
        const operationId = operationIdResponse.operation_id;

        const uploadPayload: UploadPairRequest = {
          user: 'demo-user',
          epic: DEFAULT_EPIC,
          group_id: groupId,
          group_status: 'start',
          others: {'number': 1, 'files': [files[i].file]},
          operations: [{ operation: DEFAULT_OPERATION, operation_id: operationId, status: 'doing' }]
        };
        await uploadApi.uploadPair(uploadPayload);

        // ローカルストレージへ保存
        const localStorageData: LocalStorageDataV2 = {
          user: 'demo-user',
          group_id: groupId,
          status: 'start',
        }
        addItem(localStorageData);

        const createLabelPayload: CreateLabelRequest = {
          user: 'demo-user',
          epic: DEFAULT_EPIC,
          group_id: groupId,
          group_status: 'start',
          others: {
            title,
            modelName: modelNameMap.get(files[i].id) ?? '',
          },
          operations: [{ operation: DEFAULT_OPERATION, operation_id: operationId, status: 'start' }],
        };
        requests.push({ ...createLabelPayload, fileName: files[i].file.name });
        await createLabelApi.createLabelStart(createLabelPayload);
      }
      await navigate('/');
    } catch (e) {
      window.alert('エラーが発生しました。再度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">ラベル付与</Typography>
          <Typography variant="body1" color="text.secondary">
            処理を行いたい図面を選択し、タイトルと機種名を入力して「ラベル付与開始」ボタンを押してください。
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleStart}
              disabled={files.length === 0 || isLoading}
              startIcon={isLoading ? <Loader2 size={18} className="spin" /> : undefined}
            >
              {isLoading ? '処理開始中...' : 'ラベル付与を開始する'}
            </Button>
          </Box>

          <InputFiles
            onItemsChange={handleInputItemsChange}
            onCurrentItemChange={handleCurrentItemChange}
            rightPanel={
              files.length > 0 && currentFile ? (
                <Stack spacing={1.5}>
                  <TextField
                    label="タイトル"
                    value={title}
                    onChange={handleTitleChange}
                    fullWidth
                  />
                  <TextField
                    label="機種名"
                    value={currentModelName}
                    onChange={(e) => handleModelNameChange(e, currentFile.id)}
                    fullWidth
                  />
                </Stack>
              ) : null
            }
          />
        </Stack>
      </Container>
    </Box>
  );
};
