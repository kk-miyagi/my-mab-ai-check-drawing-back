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


export const DrawingHighlightResultScreen: React.FC = () => {
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvUrl, setCsvUrl] = useState<string>();
  const [csvFileName, setCsvFileName] = useState<string>();
  const navigate = useNavigate();

  const raw = window.localStorage.getItem(localStorageKey.drawingHighlight) as string;
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
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(parsed));
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
        console.log(data)
        const zip = await JSZip.loadAsync(data);
      } catch (e) {
        console.log("エラー")
      }
    })();
  }, []);

  return (
    <div className="page">
      <h1>図面ハイライト</h1>

      <h2>結果</h2>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleRemoveItem}>最初からやり直す</button>
        <button className="primary" onClick={handleDownload}>ダウンロード</button>

      </div>
    </div>
  );
};
