import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { localStorageKey } from '../../constants/localStorageKey';
import { createLabelApi } from '../../api/createLabelApi.ts';
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


export const UpdateLabelResultScreen: React.FC = () => {
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string>();
  const [csvUrl, setCsvUrl] = useState<string>();
  const [imageFileName, setImageFileName] = useState<string>();
  const [csvFileName, setCsvFileName] = useState<string>();
  const navigate = useNavigate();

  const raw = window.localStorage.getItem(localStorageKey.default) as string;
  const parsed = JSON.parse(raw);

  // ローカルストレージの削除ボタン用
  const handleRemoveItem = () => {
    window.localStorage.removeItem(localStorageKey.default);
    console.log('ローカルストレージを削除しました。');
    navigate('/hub')
  };

  const handleDownload = async () => {
    try {
      const [imageBlob, csvBlob] = await Promise.all([
        fetchAsBlob(imageUrl as string),
        fetchAsBlob(csvUrl as string),
      ]);

      // それぞれダウンロードを発火
      downloadBlob(imageBlob, imageFileName);
      downloadBlob(csvBlob, csvFileName);
    } catch (err) {
      console.error(err);
      alert("ダウンロードに失敗しました。ネットワークやパスを確認してください。");
    }
  };

  useEffect(() => {
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(parsed));
    (async () => {
      try {
        const res = await createLabelApi.updateLabelEnd({
          user: 'demo-user',
          epic: parsed.lastEpic,
          operation: parsed.lastOperation,
          operation_id: parsed.operationId,
          status: parsed.status
        });
        const data = await res as Blob
        const zip = await JSZip.loadAsync(data);
        const imgFile = zip.file(/\.jpg$/)[0]
        if (imgFile) {
          const imgBlob = await imgFile.async('blob');
          const url = URL.createObjectURL(imgBlob);
          setImageUrl(url)
          const path = imgFile.name
          const filename = path.split("/").pop()
          setImageFileName(filename)
        }
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
        console.log("エラー")
      }
    })();
  }, []);

  return (
    <div className="page">
      <h1>ラベル付与</h1>
      <p>ラベル付与を行った図面の確認画面です。</p>
      <h2>図面の結果</h2>
      <img src={imageUrl} alt="ラベル付与後の図面" style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />

      <h2>CSVの結果</h2>
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
        <button className="primary" onClick={handleDownload}>画像とCSVを同時にダウンロード</button>
      </div>
    </div>
  );
};
