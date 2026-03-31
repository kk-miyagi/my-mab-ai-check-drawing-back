import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { localStorageKey } from '../../constants/localStorageKey';
import { drawingCompareApi } from '../../api/drawingCompareApi';
import JSZip from 'jszip';
import { useNavigate } from 'react-router-dom';

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


export const DrawingCompareResultScreen: React.FC = () => {
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvUrl, setCsvUrl] = useState<string>();
  const [csvFileName, setCsvFileName] = useState<string>();
  const navigate = useNavigate();

  const raw = window.localStorage.getItem(localStorageKey.drawingCompare) as string;
  const parsed = JSON.parse(raw);

  // ローカルストレージの削除ボタン用
  const handleRemoveItem = () => {
    navigate('/hub')
  };

  const handleDownload = async () => {
    try {
      const [csvBlob] = await Promise.all([
        fetchAsBlob(csvUrl as string),
      ]);
      downloadBlob(csvBlob, csvFileName);
    } catch (err) {
      console.error(err);
      alert("ダウンロードに失敗しました。ネットワークやパスを確認してください。");
    }
  };

  useEffect(() => {
    window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(parsed));
    (async () => {
      try {
        const res = await drawingCompareApi.drawingCompareEnd({
          user: 'demo-user',
          epic: parsed.lastEpic,
          operation: parsed.lastOperation,
          operation_id: parsed.operationId,
          status: parsed.status
        });
        const data = await res as Blob
        const zip = await JSZip.loadAsync(data);

        const csvFile = zip.file(/\.csv$/)[0]

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
          const columnsToShow = ["項目","客先図面の記載内容","客先図面の記載位置","社内用図面の記載内容","社内用図面の記載位置","差分内容","判定結果","判定理由"]
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
    <div className="page">
      <h1>図面比較</h1>

      <h2>比較結果</h2>
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
      
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleRemoveItem}>最初からやり直す</button>
        <button className="primary" onClick={handleDownload}>ダウンロード</button>

      </div>
    </div>
  );
};
