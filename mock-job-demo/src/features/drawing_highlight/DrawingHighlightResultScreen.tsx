import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { localStorageKey } from '../../constants/localStorageKey';
import { drawingCompareApi } from '../../api/drawingCompareApi';
import JSZip from 'jszip';
import { useNavigate, useLocation } from 'react-router-dom';

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

  const location = useLocation();
  const state = location.state;
  const data = state.res as Blob;
  const [baseImageUrl, setBaseImageUrl] = useState<string>();
  const [baseImageFileName, setBaseImageFileName] = useState<string>();
  const [targetImageUrl, setTargetImageUrl] = useState<string>();
  const [targetImageFileName, setTargetImageFileName] = useState<string>();
  const navigate = useNavigate();

  // ローカルストレージの削除ボタン用
  const handleRemoveItem = () => {
    navigate('/hub')
  };

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
        const zip = await JSZip.loadAsync(data);
        const baseImgFile = zip.file(/base_output_img\.jpg$/)[0]
        const targetImgFile = zip.file(/target_output_img\.jpg$/)[0]
        if (baseImgFile) {
          const imgBlob = await baseImgFile.async('blob');
          const url = URL.createObjectURL(imgBlob);
          setBaseImageUrl(url)
          const path = baseImgFile.name
          const filename = path.split("/").pop()
          setBaseImageFileName(filename)
          }
        if (targetImgFile) {
          const imgBlob = await targetImgFile.async('blob');
          const url = URL.createObjectURL(imgBlob);
          setTargetImageUrl(url)
          const path = targetImgFile.name
          const filename = path.split("/").pop()
          setTargetImageFileName(filename)
        }
      } catch (e) {
        console.log("エラー", e)
      }
    })();
  }, [])

  return (
    <div className="page">
      <h1>図面ハイライト</h1>

      <h2>結果</h2>
      <h3>修正前</h3>
      <img src={baseImageUrl} alt="ラベル付与後の図面" style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />

      <h3>修正後</h3>
      <img src={targetImageUrl} alt="ラベル付与後の図面" style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleRemoveItem}>最初からやり直す</button>
        <button className="primary" onClick={handleDownload}>ダウンロード</button>

      </div>
    </div>
  );
};
