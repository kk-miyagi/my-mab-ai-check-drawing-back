import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { localStorageKey } from '../../constants/localStorageKey';
import { LocalStorageData } from '../../types/storage.ts';
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

export const DrawingCompareResultScreen: React.FC = () => {
  const [basePdfFile, setBasePdfFile] = useState<PdfFile>();
  const [targetPdfFile, setTargetPdfFile] = useState<PdfFile>();
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvUrl, setCsvUrl] = useState<string>();
  const [csvFileName, setCsvFileName] = useState<string>();

  const handleDownload = async () => {
    try {
      if (!basePdfFile) return;
      if (!targetPdfFile) return;
      if (!csvFileName) return;
      if (!csvUrl) return;
      const [baseBlob, targetBlob, csvBlob] = await Promise.all([
        fetchAsBlob(basePdfFile.url),
        fetchAsBlob(targetPdfFile.url),
        fetchAsBlob(csvUrl),
      ]);
      downloadBlob(csvBlob, csvFileName);
      downloadBlob(baseBlob, basePdfFile.fileName);
      downloadBlob(targetBlob, targetPdfFile.fileName);
    } catch (err) {
      console.error(err);
      alert("ダウンロードに失敗しました。ネットワークやパスを確認してください。");
    }
  };

  useEffect(() => {
    const getLocalStorage = window.localStorage.getItem(localStorageKey.drawingCompare)
    if (!getLocalStorage) {
      return
    }
    const localStorageData: LocalStorageData  = JSON.parse(getLocalStorage);
    if (!localStorageData.operationId) {
      return
    }

    (async () => {
      try {
        if (!localStorageData.operationId) {
          return
        }
        const res = await drawingCompareApi.drawingCompareEnd({
          user: localStorageData.user,
          epic: localStorageData.epic,
          operation: localStorageData.operation,
          operation_id: localStorageData.operationId,
          status: localStorageData.status,
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
            fileName: filename,
            url: url
          };
          setBasePdfFile(file);
        }

        if (target) {
          const pdfBlob = await target.async('blob');
          const url = URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" }));
          const path = target.name;
          const filename = path.split("/").pop()!;
          const file: PdfFile = {
            fileName: filename,
            url: url
          };
          setTargetPdfFile(file);
        }

        if (csvFile) {
          const text = await csvFile.async("string");
          const csvBlob = await csvFile.async('blob');
          setCsvUrl(URL.createObjectURL(csvBlob));
          const path = csvFile.name
          const filename = path.split("/").pop()
          setCsvFileName(filename)
          const result = Papa.parse<Row>(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
          });
          const csvData = result.data ?? [];
          const columnsToShow = ["項目","客先図面の記載内容", "客先図面の矩形領域番号","客先図面の記載位置","社内用図面の記載内容", "社内用図面の矩形領域番号", "社内用図面の記載位置","差分内容","判定結果","判定理由"]
          const projected = csvData.map((row) => {
            const picked: Row = {};
            for (const key of columnsToShow) {
              picked[key] = row[key] ?? "";
            }
            return picked;
          });

          setCsvRows(projected);
          setCsvColumns(projected.length ? Object.keys(projected[0]) : []);
        }
        

      } catch (e) {
        //TODO
      }
    })();
  }, []);

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">差分ハイライト</Typography>
          <Typography variant="body1" color="text.secondary">
            ダウンロードボタンを押すと、結果図面がダウンロードされます。
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleDownload}
            >
              ダウンロード
            </Button>
          </Box>
          <Stack direction="row" spacing={2}>
            {basePdfFile && (
              <>
              <Box sx={{ flex: 1 }}>
              <Typography variant="h6" align="center" gutterBottom>基準側(客先)の図面</Typography>
              <PdfPreview preview={basePdfFile.url} /></Box>
              </>
            )}
          
            {targetPdfFile && (
              <>
              <Box sx={{ flex: 1 }}>
              <Typography variant="h6" align="center" gutterBottom>比較側(自社)の図面</Typography>
              <PdfPreview preview={targetPdfFile.url} /></Box>
              </>
            )}
          </Stack>
          <Box>
            {csvColumns && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {csvColumns.map((c) => (
                        <TableCell key={c}>{c}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {csvRows.map((r, i) => (
                      <TableRow key={i}>
                        {csvColumns.map((c) => (
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
