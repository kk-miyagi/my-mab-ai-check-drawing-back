import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom';
import JSZip from 'jszip';
import { localStorageKey } from '../../constants/localStorageKey';
import { LocalStorageData } from '../../types/storage.ts';
import { drawingReviewApi } from '../../api/drawingReviewApi';
import * as XLSX from 'xlsx';

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

type SheetData = {
  name: string;
  rows: (string | number | boolean | Date | null)[][];
};

export const DrawingReviewResultScreen: React.FC = () => {

  const [excelFileUrl, setExcelFileUrl] = useState<string>();
  const [excelFileName, setExcelFileName] = useState<string>();

  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const handleDownload = async () => {
    try {
      const [excelBlob] = await Promise.all([
        fetchAsBlob(excelFileUrl as string),
      ]);

      // それぞれダウンロードを発火
      downloadBlob(excelBlob, excelFileName);
    } catch (err) {
      console.error(err);
      alert("ダウンロードに失敗しました。ネットワークやパスを確認してください。");
    }
  };

  const handleSlice = (sheet_name: string): number => {
    if (sheet_name === "図面審査シート") {
      return 7
    } else {
      return 0
    }
  }

  useEffect(() => {
    const getLocalStorage = window.localStorage.getItem(localStorageKey.drawingReview)
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
        const res = await drawingReviewApi.drawingReviewEnd({
          user: localStorageData.user,
          epic: localStorageData.epic,
          operation: localStorageData.operation,
          operation_id: localStorageData.operationId,
          status: localStorageData.status,
        });
        const data = await res as Blob
        const zip = await JSZip.loadAsync(data);
        const excelFile = zip.file(/\.xlsx$/)[0]
        if (excelFile) {
          const Blob = await excelFile.async('blob');
          const url = URL.createObjectURL(Blob);
          setExcelFileUrl(url)
          const path = excelFile.name
          const filename = path.split("/").pop()
          setExcelFileName(filename)

          setSheets([]);
          setActiveIndex(0);
          const buffer = await Blob.arrayBuffer()
          const wb = XLSX.read(buffer, { type: 'array', cellDates: true})
          const nextSheets: SheetData[] = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name];
            const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
              ws,
              { header: 1, raw: false, defval: null }
            );
            return { name, rows };
          });
          setSheets(nextSheets);
        }

      } catch (e) {
        // TODO
      }
    })();
  }, []);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>図面審査の結果表示</h2>
        <Link to="/hub" >ホームに戻る</Link>
      </div>

      {sheets.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sheets.map((s, idx) => (
            <button
              key={s.name}
              onClick={() => setActiveIndex(idx)}
              style={{
                padding: '6px 10px',
                border: '1px solid #ccc',
                background: idx === activeIndex ? 'green' : '#fff',
                cursor: 'pointer',
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {sheets[activeIndex] && (
        <div style={{ marginTop: 12, overflowX: 'auto' }} className='table-wrapper'>
          <table
            style={{
              borderCollapse: 'collapse',
              minWidth: 600,
            }}
          >
            <tbody className='table-row'>
              {sheets[activeIndex].rows.slice(handleSlice(sheets[activeIndex].name)).map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        border: '1px solid #ddd',
                        padding: '6px 10px',
                        whiteSpace: 'nowrap',
                      }}
                      title={String(cell ?? '')}
                    >
                      {String(cell ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* 行数・列数の簡易表示 */}
          <p style={{ marginTop: 8, color: '#666' }}>
            {sheets[activeIndex].name}：{sheets[activeIndex].rows.length} 行 ×{" "}
            {Math.max(0, ...sheets[activeIndex].rows.map(r => r.length))} 列
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleDownload}>図面審査シートをダウンロード</button>
      </div>
    </div>
  );
};
