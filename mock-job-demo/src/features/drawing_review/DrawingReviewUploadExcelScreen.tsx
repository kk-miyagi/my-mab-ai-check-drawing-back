import React, { useState, ChangeEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { OperationIssueRequest } from '../../types/upload.ts';
import { issueOperationIdApi } from '../../api/issueOperationIdApi.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import * as XLSX from 'xlsx';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Header } from '../../components/Header';
import { InputExcelFile } from '../../components/InputExcelFile';

const DEFAULT_EPIC = 'drawing-review';
const DEFAULT_OPERATION = 'upload-excel';

type SheetData = {
  name: string;
  rows: (string | number | boolean | Date | null)[][];
};

export const DrawingReviewUploadExcelScreen: React.FC = () => {

  const [excelFile, setExcelFile] = useState<File[]>([]);

  const navigate = useNavigate();

  // 追加
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const [title, setTitle] = useState<string>("");
  const [modelName, setModelName] = useState<string>("");

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleModelNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setModelName(e.target.value);
  };

  const handleSetExcelFile = async (selectedFile: File | null) => {
    if (selectedFile) {
      setExcelFile([selectedFile]);

      // 追加
      setSheets([]);
      setActiveIndex(0);
      const buffer = await selectedFile.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true})
      const nextSheets: SheetData[] = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        // header: 1 で行列の2次元配列を得る（表として使いやすい）
        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
          ws,
          { header: 1, raw: false, defval: null } // defvalで空セルにnullを入れる
        );
        return { name, rows };
      });
      setSheets(nextSheets);

    } else {
      setExcelFile([]);
      setSheets([])
    }
  };

  const handleSlice = (sheet_name: string): number => {
    if (sheet_name === "図面審査シート") {
      return 7
    } else {
      return 0
    }
  }

  const handleStart = async () => {
    // ローカルストレージの初期化
    const localStorageData: LocalStorageData = {
      user: 'demo-user',
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
      operationId: null,
      status: 'start'
    }
    window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));
    
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
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));
    
      // アップロード
      localStorageData.status = 'doing';
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData))
      const requestPayload = {
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: localStorageData.status,
        number: 1,
        files: excelFile,
      };
      await uploadApi.uploadPair(requestPayload);
      localStorageData.status = 'end';
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData))
      
      await navigate("/drawing-review", { state: { sheets }})
    } catch (e) {
      localStorageData.status = 'error';
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));
      window.alert("処理に失敗したため、画面を切り替えます");
      navigate("/drawing-review-upload-excel");
    }
  }

  type Row = Record<string, string | number | boolean | null>;
  const matchesCondition = (row: Row): boolean => {
    return row[6] === "可";
  };
  const [validation01, setValidation01] = useState<string[]>([]);
  const [validation02, setValidation02] = useState<string[]>([]);

  useEffect(() => {
    setValidation01([])
    setValidation02([])
    if (sheets.length > 0) {
      const targetIndex = sheets.findIndex(sheet => sheet.name ==="図面審査シート");
      const targetRows = sheets[targetIndex].rows.slice(8).filter((row) => matchesCondition(row))
      
      Object.keys(targetRows).forEach((i) => {
        if (!targetRows[i][3].endsWith('-01')) {
          setValidation01(prev => [...prev, targetRows[i]])
        }
        if (!targetRows[i][7].endsWith('-02')) {
          setValidation02(prev => [...prev, targetRows[i]])
        }
      })
    }
  }, [sheets])

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">図面審査</Typography>
          <Typography variant="body1" color="text.secondary">
            処理を行いたい図面審査を選択し、タイトルと機種名を入力して「次へ」ボタンを押してください。
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleStart}
              disabled={excelFile.length === 0 || validation01.length > 0 || validation02.length > 0}
            >
              次へ
            </Button>
          </Box>

          <InputExcelFile onFileChange={handleSetExcelFile} />

          {validation01.length > 0  && (
            <Alert severity='error'>
              <AlertTitle>指摘先の図番の末尾に「-01」が無いようです。</AlertTitle>
              <ul>{validation01.map((i) => (<li>No:{i[0]} {i[3]}</li>))}</ul>
            </Alert>
          )}

          {validation02.length > 0  && (
            <Alert severity='error'>
              <AlertTitle>反映先の図番の末尾に「-02」が無いようです。</AlertTitle>
              <ul>{validation02.map((i) => (<li>No:{i[0]} {i[7]}</li>))}</ul>
            </Alert>
          )}

          {sheets.length > 0 && (
            <>
              <ToggleButtonGroup
                value={activeIndex}
                exclusive
                onChange={(_, v) => v !== null && setActiveIndex(v)}
                sx={{ mt: 1.5, flexWrap: 'wrap' }}
                size="small"
              >
                {sheets.map((s, idx) => (
                  <ToggleButton key={s.name} value={idx}>
                    {s.name}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <Box
                sx={{
                  mt: 1.5,
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 2,
                  alignItems: 'flex-start',
                }}
              >
                {/* 左：テーブル */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {sheets[activeIndex] && (
                    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 600 }}>
                        <TableBody>
                          {sheets[activeIndex].rows
                            .slice(handleSlice(sheets[activeIndex].name))
                            .map((row, rIdx) => (
                              <TableRow key={rIdx} hover>
                                {row.map((cell, cIdx) => (
                                  <TableCell
                                    key={cIdx}
                                    title={String(cell ?? '')}
                                    sx={{ whiteSpace: 'nowrap' }}
                                  >
                                    {String(cell ?? '')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>

                {/* 右：入力欄 */}
                <Stack spacing={2} sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
                  <TextField
                    label="タイトル"
                    value={title}
                    onChange={handleTitleChange}
                    size="small"
                  />
                  <TextField
                    label="機種名"
                    value={modelName}
                    onChange={handleModelNameChange}
                    size="small"
                  />
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  )
}
