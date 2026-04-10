import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { localStorageKey } from '../../constants/localStorageKey';
import { LocalStorageData } from '../../types/storage.ts';
import { createLabelApi } from '../../api/createLabelApi.ts';
import JSZip from 'jszip';
import { useNavigate } from 'react-router-dom';
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

  // ホーム画面へ遷移
  const handleNavigate = () => {
    navigate('/')
  };

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

  // 編集画面への遷移
  const handleMove = async () => {
    navigate('/update-label', { state: { currentImageFile }})
  }

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
    <div className="page">
      <h1>ラベル付与</h1>
      <p>ラベル付与を行った図面の確認画面です。</p>
      <h2>図面の結果</h2>

      {pdfFiles.length > 0 && currentPdfFile && (
        <PdfPreview preview={currentPdfFile.url} />
      )}
      <img src={currentImageFile?.url} />

      <h2>CSVの結果</h2>
      
      {csvFiles.length > 0 && currentCsvFile && (
        <div className='table-wrapper'>
          <table>
            <thead>
              <tr>{csvColumns.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody className='table-row'>
              {csvRows.map((r, i) => (
                <tr key={i}>
                  {csvColumns.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleNavigate}>最初からやり直す</button>
          <button className="primary" onClick={handleDownload}>図面と設計情報を同時にダウンロード</button>
        <button className="primary" onClick={handleMove}>編集画面へ</button>
      </div>
    </div>
  );
};
