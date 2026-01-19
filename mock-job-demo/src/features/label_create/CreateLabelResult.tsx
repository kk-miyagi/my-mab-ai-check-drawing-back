import React, { useEffect, useState, useMemo } from 'react';
import Papa, { ParseResult } from 'papaparse';
import { localStorageKey } from '../../constants/localStorageKey';
import sampleCsvUrl from './test.csv?url'
import sampleImageUrl from './3Tm_TKE-171433_03_DRAFT2_page_1.jpg?url'

type Row = Record<string, string | number | boolean | null>;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Firefox対応：DOMに追加してからclick
  document.body.appendChild(a);
  a.click();
  a.remove();
  // すぐrevokeするとSafariで稀に失敗するためsetTimeoutが安全
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const fetchAsBlob = async (url: string): Promise<Blob> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch: ${url} (${res.status})`);
  return await res.blob();
};

export const CreateLabelResultScreen: React.FC = () => {


  // 削除ボタン用
  const handleRemoveItem = () => {
    window.localStorage.removeItem(localStorageKey.default);
    console.log('削除しました。');
  };

  // ローカルストレージからid取得して画面に表示
  const raw = window.localStorage.getItem(localStorageKey.default);
  const parsed = JSON.parse(raw);
  console.log("[結果画面] ローカルストレージ: ", parsed);

  // ここからCSV
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>([]);

  const handleDownload = async () => {
    try {
      // public配下のパスは / から始める

      // 画像とCSVを同時に取得（ユーザー操作内）
      const [imageBlob, csvBlob] = await Promise.all([
        fetchAsBlob(sampleImageUrl),
        fetchAsBlob(sampleCsvUrl),
      ]);

      // それぞれダウンロードを発火
      downloadBlob(imageBlob, "sample.jpg");
      downloadBlob(csvBlob, "data.csv");
    } catch (err) {
      console.error(err);
      alert("ダウンロードに失敗しました。ネットワークやパスを確認してください。");
    }
  };

  useEffect(() => {
    (async () => {
      const res = await fetch(sampleCsvUrl);
      const text = await res.text();
      console.log(text)
      const result = Papa.parse<Row>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });
      const data = result.data ?? [];
      setRows(data);
      setColumns(data.length ? Object.keys(data[0]) : []);
    })();
  }, []);

  return (
    <div className="page">
      <h1>ラベル付与の完了</h1>
      <p>ラベル付与を行った図面の確認画面です。</p>
      <h2>図面の結果</h2>
      <img src={sampleImageUrl} alt="ラベル付与後の図面" style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />

      <h2>一覧の結果</h2>
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleRemoveItem}>ローカルストレージの削除</button>
        <button className="primary" onClick={handleDownload}>画像とCSVを同時にダウンロード</button>
      </div>
    </div>
  );
};
