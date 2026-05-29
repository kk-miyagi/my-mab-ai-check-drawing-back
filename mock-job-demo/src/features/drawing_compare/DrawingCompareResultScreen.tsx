import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Papa from 'papaparse';
import { drawingCompareApi } from '../../api/drawingCompareApi';
import JSZip from 'jszip';
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
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { Header } from '../../components/Header';
import { PdfPreview } from '../../components/PdfPreview.tsx';

type Row = Record<string, string | number | boolean | null>;

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

type PdfFile = {
  fileName: string;
  url: string;
}

type CsvFile = {
  fileName: string;
  url: string;
  rows: Row[];
  columns: string[];
}

export const DrawingCompareResultScreen: React.FC = () => {
  const location = useLocation();
  const state = location.state;
  const drawingComparePayload = state.drawingComparePayload;
  const [basePdfFile, setBasePdfFile] = useState<PdfFile[]>([]);
  const [targetPdfFile, setTargetPdfFile] = useState<PdfFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [csvFiles, setCsvFiles] = useState<CsvFile[]>([]);

  const handleDownload = async () => {
    try {
      if (!basePdfFile || basePdfFile.length === 0) return;
      if (!targetPdfFile || targetPdfFile.length === 0) return;
      const csvFile = csvFiles[currentIndex];
      if (!csvFile) return;
      const base = basePdfFile[currentIndex];
      const target = targetPdfFile[currentIndex];
      if (!base || !target) return;
      const [baseBlob, targetBlob, csvBlob] = await Promise.all([
        fetchAsBlob(base.url),
        fetchAsBlob(target.url),
        fetchAsBlob(csvFile.url),
      ]);
      downloadBlob(csvBlob, csvFile.fileName);
      downloadBlob(baseBlob, base.fileName);
      downloadBlob(targetBlob, target.fileName);
    } catch (err) {
      console.error(err);
      alert("ダウンロードに失敗しました。ネットワークやパスを確認してください。");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        for (let i = 0; i < drawingComparePayload.operations.length; i++) {
          const op = drawingComparePayload.operations[i];
          const res = await drawingCompareApi.drawingCompareEnd({
            user: drawingComparePayload.user,
            epic: drawingComparePayload.epic,
            group_id: drawingComparePayload.group_id,
            group_status: drawingComparePayload.group_status,
            others: drawingComparePayload.others,
            operations: [op],
          });
          const zip = await JSZip.loadAsync(res);
          const base = zip.file(/base.*\.pdf$/)[0];
          const target = zip.file(/target.*\.pdf$/)[0];
          const csvFile = zip.file(/\.csv$/)[0];
          if (base) {
            const pdfBlob = await base.async('blob');
            const url = URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" }));
            const path = base.name;
            const filename = path.split("/").pop()!;
            const file: PdfFile = {
              fileName: `${i}_${filename}`,
              url: url
            };
            setBasePdfFile(prev => {
              const exists = prev.some(f => f.fileName === file.fileName);
              if (exists) {
                return prev;
              }
              return [...prev, file];
            });

          if (target) {
            const pdfBlob = await target.async('blob');
            const url = URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" }));
            const path = target.name;
            const filename = path.split("/").pop()!;
            const file: PdfFile = {
              fileName: `${i}_${filename}`,
              url: url
            };
            setTargetPdfFile(prev => {
              const exists = prev.some(f => f.fileName === file.fileName);
              if (exists) {
                return prev;
              }
              return [...prev, file];
            });
          }

          if (csvFile) {
            const text = await csvFile.async("string");
            const csvBlob = await csvFile.async('blob');
            const url = URL.createObjectURL(csvBlob);
            const path = csvFile.name;
            const filename = path.split("/").pop()!;
            const result = Papa.parse<Row>(text, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: true,
            });
            const csvData = result.data ?? [];
            const columnsToShow = ["項目","客先図面の記載内容", "客先図面の矩形領域番号","客先図面の記載位置","社内用図面の記載内容", "社内用図面の矩形領域番号", "社内用図面の記載位置","差分内容","判定結果","判定理由"];
            const projected = csvData.map((row) => {
              const picked: Row = {};
              for (const key of columnsToShow) {
                picked[key] = row[key] ?? "";
              }
              return picked;
            });

            const csvObj: CsvFile = {
              fileName: `${i}_${filename}`,
              url,
              rows: projected,
              columns: projected.length ? Object.keys(projected[0]) : [],
            };

            setCsvFiles(prev => {
              const exists = prev.some(f => f.fileName === csvObj.fileName);
              if (exists) return prev;
              return [...prev, csvObj];
            });
          }
          }
        }
      } catch (e) {
        //TODO
      }
    })();
  }, []);

  useEffect(() => {
    const max = Math.max(drawingComparePayload.operations.length);
    if (max === 0) {
      setCurrentIndex(0);
      return;
    }
    if (currentIndex >= max) {
      setCurrentIndex(0);
    }
  }, [drawingComparePayload.operations.length]);

  const currentCsv = csvFiles[currentIndex];

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">図面比較</Typography>
          <Typography variant="body1" color="text.secondary">
            ダウンロードボタンを押すと、比較結果がダウンロードされます。
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleDownload}
            >
              ダウンロード
            </Button>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex <= 0}
            >
              前へ
            </Button>
            <Typography>
              {basePdfFile.length > 0 ? `${currentIndex + 1} / ${Math.max(drawingComparePayload.operations.length)}` : '0 / 0'}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setCurrentIndex((i) => i + 1)}
              disabled={currentIndex >= Math.max(drawingComparePayload.operations.length) - 1}
            >
              次へ
            </Button>
          </Box>

          <Stack direction="row" spacing={2}>
            {basePdfFile.length > 0 && targetPdfFile.length > 0 && (
              <>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" align="center" gutterBottom>基準側(客先)の図面</Typography>
                  <PdfPreview preview={basePdfFile[currentIndex]?.url} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" align="center" gutterBottom>比較側(自社)の図面</Typography>
                  <PdfPreview preview={targetPdfFile[currentIndex]?.url} />
                </Box>
              </>
            )}
          </Stack>
          <Box>
            {currentCsv && currentCsv.columns.length > 0 && (
              <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {currentCsv.columns.map((c) => (
                        <TableCell key={c}>{c}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentCsv.rows.map((r, i) => (
                      <TableRow key={i}>
                        {currentCsv.columns.map((c) => (
                          <TableCell key={c}>{String(r[c] ?? '')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Stack>
      </Container>
    </Box>
  );
};
