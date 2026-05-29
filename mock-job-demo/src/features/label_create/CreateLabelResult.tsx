import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { createLabelApi } from '../../api/createLabelApi.ts';
import JSZip from 'jszip';
import { useLocation, useNavigate } from 'react-router-dom';
import { PdfPreview } from '../../components/PdfPreview.tsx';
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Switch,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Header } from '../../components/Header';
import {
  Download,
} from '@mui/icons-material';

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
  const [isBoxOn, setIsBoxOn] = useState(false);

  const updateLabelPayload = useLocation().state.updateLabelPayload;

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

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsBoxOn(event.target.checked);
    if (event.target.checked) {
      setCurrentPdfFile(pdfFiles[1]);
    } else {
      setCurrentPdfFile(pdfFiles[0]);
    }
  };

  useEffect(() => {

    (async () => {
      setPdfFiles([]);
      setCsvFiles([]);
      try {
        const res = await createLabelApi.updateLabelEnd({
          user: updateLabelPayload.user,
          epic: updateLabelPayload.epic,
          group_id: updateLabelPayload.group_id,
          group_status: updateLabelPayload.group_status,
          others: updateLabelPayload.others,
          operations: [{ operation: "update-label", operation_id: updateLabelPayload.operations[0].operation_id, status: "end" }]
        });

        const zip = await JSZip.loadAsync(res);
        const pdfFile1 = zip.file(/no_box.*\.pdf$/i)[0];
        const pdfFile2 = zip.file(/^(?!.*no_box).*\.pdf$/i)[0];
        const csvFile = zip.file(/\.csv$/)[0];

        if (pdfFile1) {
          const pdfBlob = await pdfFile1.async('blob');
          const url = URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" }));
          const path = pdfFile1.name;
          const filename = path.split("/").pop()!;
          const file: PdfFile = {
            fileName: filename,
            url: url
          };
          setPdfFiles([file]);
          setCurrentPdfFile([file][0]);
        }

        if (pdfFile2) {
          const pdfBlob = await pdfFile2.async('blob');
          const url = URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" }));
          const path = pdfFile2.name;
          const filename = path.split("/").pop()!;
          const file: PdfFile = {
            fileName: filename,
            url: url
          };
          setPdfFiles(prev => {
            if (prev.length >= 2) {
              const next = [...prev];
              next[1] = file;
              return next;
            }
            return [...prev, file];
          });
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
          <Switch
            checked={isBoxOn}
            onChange={handleSwitchChange}
          />
            <Button
              variant="contained"
              onClick={handleDownload}
              startIcon={<Download />}
            >
              ダウンロード
            </Button>
          </Box>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 2 }}>
              {pdfFiles.length > 0 && currentPdfFile && (
                <>
                <Typography variant="h6" align="center" gutterBottom>ラベル付与後の図面</Typography>
                <PdfPreview preview={currentPdfFile.url} />
                </>
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              {csvFiles.length > 0 && currentCsvFile && (
                <>
                <Typography variant="h6" align="center" gutterBottom>設計情報</Typography>
                <TableContainer component={Paper}>
                  <Table>
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
                </>
              )}
            </Box>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};
