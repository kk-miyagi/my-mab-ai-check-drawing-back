import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { localStorageKey } from '../../constants/localStorageKey';
import { LocalStorageData } from '../../types/storage.ts';
import { createLabelApi } from '../../api/createLabelApi.ts';
import JSZip from 'jszip';
import { useNavigate } from 'react-router-dom';
import { PdfPreview } from '../../components/PdfPreview.tsx';
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
}

type ImageFile = {
  fileName: string;
  url: string;
}

export const CreateLabelResultScreen: React.FC = () => {
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [currentPdfFile, setCurrentPdfFile] = useState<PdfFile | null>();
  const [csvFiles, setCsvFiles] = useState<CsvFile[]>([]);
  const [currentCsvFile, setCurrentCsvFile] = useState<CsvFile | null>();
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [currentImageFile, setCurrentImageFile] = useState<ImageFile | null>();
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);

  const navigate = useNavigate();

  const handleDownload = async () => {
    try {
      if (!currentPdfFile) return;
      if (!currentCsvFile) return;
      const [pdfBlob, csvBlob] = await Promise.all([
        fetchAsBlob(currentPdfFile.url),
        fetchAsBlob(currentCsvFile.url),
      ]);

      // それぞれダウンロードを発火
      downloadBlob(pdfBlob, currentPdfFile.fileName);
      downloadBlob(csvBlob, currentCsvFile.fileName);
    } catch (e) {
      window.alert("ダウンロードに失敗しました。ネットワークやパスを確認してください。");
    }
  };

  useEffect(() => {
    const getLocalStorage = window.localStorage.getItem(localStorageKey.createLabel)
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

        const res = await createLabelApi.createLabelEnd({
          user: localStorageData.user,
          epic: localStorageData.epic,
          operation: localStorageData.operation,
          operation_id: localStorageData.operationId,
          status: localStorageData.status,
        });

        // TODO: 複数出力がある場合
        const zip = await JSZip.loadAsync(res);
        const pdfFile = zip.file(/\.pdf$/)[0];
        const csvFile = zip.file(/\.csv$/)[0];
        const imgFile = zip.file(/\.jpg$/)[0];

        if (pdfFile) {
          const pdfBlob = await pdfFile.async('blob');
          const url = URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" }));
          const path = pdfFile.name;
          const filename = path.split("/").pop()!;
          const file: PdfFile = {
            fileName: filename,
            url: url
          };
          setPdfFiles([file]);
          setCurrentPdfFile([file][0]);
        }

        if (imgFile) {
          const imgfBlob = await imgFile.async('blob');
          const url = URL.createObjectURL(imgfBlob);
          const path = imgFile.name;
          const filename = path.split("/").pop()!;
          const file: ImageFile = {
            fileName: filename,
            url: url
          };
          setImageFiles([file]);
          setCurrentImageFile([file][0]);
        }

        if (csvFile) {
          const csvBlob = await csvFile.async('blob');
          const url = URL.createObjectURL(csvBlob);
          const path = csvFile.name;
          const filename = path.split("/").pop()!;
          const file: CsvFile = {
            fileName: filename,
            url: url
          };
          setCsvFiles([file]);
          setCurrentCsvFile([file][0]);

          const text = await csvFile.async("string");
          const result = Papa.parse<Row>(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
          });
          const csvData = result.data ?? [];
          const columnsToShow = ['No', '項目','寸法値または品質指定等の記載内容', '備考']
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
        window.alert("エラーが発生したため画面を切り替えます");
        navigate("/");
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (pdfFiles.length > 0) {
        pdfFiles.map((file) => (
          URL.revokeObjectURL(file.url)
        ))
      }
    };
  }, [pdfFiles]);

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">ラベル付与</Typography>
          <Typography variant="body1" color="text.secondary">
            ダウンロードボタンを押すと、ラベル付与結果がダウンロードされます。
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleDownload}
            >
              ダウンロード
            </Button>
          </Box>

          {pdfFiles.length > 0 && currentPdfFile && (
            <PdfPreview preview={currentPdfFile.url} />
          )}

          {csvFiles.length > 0 && currentCsvFile && (
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
          
        </Stack>
      </Container>
    </Box>
  );
};
