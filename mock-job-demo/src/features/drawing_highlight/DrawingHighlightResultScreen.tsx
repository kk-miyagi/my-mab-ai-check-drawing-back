import React, { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { Header } from '../../components/Header';
import { PdfPreview } from '../../components/PdfPreview';
import { drawingHighlightApi } from '../../api/drawingHighlightApi';

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


export const DrawingHighlightResultScreen: React.FC = () => {

  const location = useLocation();
  const state = location.state;
  const drawingHighlightPayload = state.drawingHighlightPayload;
  const [baseImageUrl, setBaseImageUrl] = useState<string>();
  const [baseImageFileName, setBaseImageFileName] = useState<string>();
  const [targetImageUrl, setTargetImageUrl] = useState<string>();
  const [targetImageFileName, setTargetImageFileName] = useState<string>();

  const handleDownload = async () => {
    try {
      const [imageBlob, csvBlob] = await Promise.all([
        fetchAsBlob(baseImageUrl as string),
        fetchAsBlob(targetImageUrl as string),
      ]);

      // それぞれダウンロードを発火
      downloadBlob(imageBlob, baseImageFileName);
      downloadBlob(csvBlob, targetImageFileName);
    } catch (err) {
      console.error(err);
      alert("ダウンロードに失敗しました。ネットワークやパスを確認してください。");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await drawingHighlightApi.drawingHighlightEnd(drawingHighlightPayload)
        const zip = await JSZip.loadAsync(res);
        const base = zip.file(/_highlight_result_0\.pdf$/)[0];
        const target = zip.file(/_highlight_result_1\.pdf$/)[0];

        if (base) {
          const pdfBlob = await base.async('blob');
          const url = URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" }));
          const path = base.name;
          const filename = path.split("/").pop()!;
          setBaseImageUrl(url);
          setBaseImageFileName(filename);
        }

        if (target) {
          const pdfBlob = await target.async('blob');
          const url = URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" }));
          const path = target.name;
          const filename = path.split("/").pop()!;
          setTargetImageUrl(url);
          setTargetImageFileName(filename);
        }
      } catch (e) {
        // TODO
      }
    })();
  }, [])

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

          
          {baseImageUrl && (
            <>
            <Box sx={{ flex: 1 }}>
            <Typography variant="h6" align="center" gutterBottom>修正前の図面</Typography>
            <PdfPreview preview={baseImageUrl} /></Box>
            </>
          )}
          
          {targetImageUrl && (
            <>
            <Box sx={{ flex: 1 }}>
            <Typography variant="h6" align="center" gutterBottom>修正後の図面</Typography>
            <PdfPreview preview={targetImageUrl} /></Box>
            </>
          )}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};
