import React, { useEffect, useState } from 'react'
import JSZip from 'jszip';
import { drawingReviewApi } from '../../api/drawingReviewApi';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Box,
  Button,
  Container,
  Stack,
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

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const fetchAsBlob = async (url: string): Promise<Blob> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch: ${url} (${res.status})`);
  return await res.blob();
};

type SheetData = {
  name: string;
  rows: (string | number | boolean | Date | null)[][];
};

export const DrawingReviewResultScreen: React.FC = () => {

  const [excelFileUrl, setExcelFileUrl] = useState<string>();
  const [excelFileName, setExcelFileName] = useState<string>();

  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const drawingReviewPayload = useLocation().state.drawingReviewPayload;
  const navigate = useNavigate();

  const handleDownload = async () => {
    try {
      const [excelBlob] = await Promise.all([
        fetchAsBlob(excelFileUrl as string),
      ]);

      // それぞれダウンロードを発火
      downloadBlob(excelBlob, excelFileName);
    } catch (err) {
      console.error(err);
      alert("ダウンロードに失敗しました。ネットワークやパスを確認してください。");
    }
  };

  const handleSlice = (sheet_name: string): number => {
    if (sheet_name === "図面審査シート") {
      return 7
    } else {
      return 0
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await drawingReviewApi.drawingReviewEnd(drawingReviewPayload);
        const zip = await JSZip.loadAsync(res);
        const excelFile = zip.file(/\.xlsx$/)[0]
        if (excelFile) {
          const Blob = await excelFile.async('blob');
          const url = URL.createObjectURL(Blob);
          setExcelFileUrl(url)
          const path = excelFile.name
          const filename = path.split("/").pop()
          setExcelFileName(filename)

          setSheets([]);
          setActiveIndex(0);
          const buffer = await Blob.arrayBuffer()
          const wb = XLSX.read(buffer, { type: 'array', cellDates: true})
          const nextSheets: SheetData[] = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name];
            const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
              ws,
              { header: 1, raw: false, defval: null }
            );
            return { name, rows };
          });
          setSheets(nextSheets);
        }

      } catch (e) {
        window.alert("エラーが発生したため画面を切り替えます");
        navigate("/");
      }
    })();
  }, []);

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">図面審査</Typography>
          <Typography variant="body1" color="text.secondary">
            ダウンロードボタンを押すと、図面審査シートがダウンロードされます。
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleDownload}
            >
              ダウンロード
            </Button>
          </Box>

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
              <Box>
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
            </>
          )}
        </Stack>
      </Container>
     
    </Box>
  );
};
