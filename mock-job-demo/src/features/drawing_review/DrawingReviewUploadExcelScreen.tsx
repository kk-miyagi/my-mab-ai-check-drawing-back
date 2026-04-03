import React, { useState, ChangeEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { OperationIssueRequest } from '../../types/upload.ts';
import { issueOperationIdApi } from '../../api/issueOperationIdApi.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import * as XLSX from 'xlsx';

const DEFAULT_EPIC = 'drawing-review';
const DEFAULT_OPERATION = 'upload-excel';

type SheetData = {
  name: string;
  rows: (string | number | boolean | Date | null)[][];
};

export const DrawingReviewUploadExcelScreen: React.FC = () => {

  const [excelFile, setExcelFile] = useState<File[]>([]);

  const navigate = useNavigate();

  // 追加
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const handleSetExcelFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setExcelFile([selectedFile]);

      

      // 追加
      setSheets([]);
      setActiveIndex(0);
      const buffer = await selectedFile.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true})
      const nextSheets: SheetData[] = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        // header: 1 で行列の2次元配列を得る（表として使いやすい）
        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
          ws,
          { header: 1, raw: false, defval: null } // defvalで空セルにnullを入れる
        );
        return { name, rows };
      });
      setSheets(nextSheets);

    } else {
      setExcelFile([]);
      setSheets([])
    }
  };

  const handleSlice = (sheet_name: string): number => {
    if (sheet_name === "図面審査シート") {
      return 7
    } else {
      return 0
    }
  }

  const handleStart = async () => {
    // ローカルストレージの初期化
    const localStorageData: LocalStorageData = {
      user: 'demo-user',
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
      operationId: null,
      status: 'start'
    }
    window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));
    
    try {
      // オペレーションIDの発行
      const metaPayload: OperationIssueRequest = {
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: 'start',
      };
      const issueResult = await issueOperationIdApi(metaPayload);
      localStorageData.operationId = issueResult.operation_id
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));
    
      // アップロード
      localStorageData.status = 'doing';
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData))
      const requestPayload = {
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: localStorageData.status,
        number: 1,
        files: excelFile,
      };
      await uploadApi.uploadPair(requestPayload);
      localStorageData.status = 'end';
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData))
      
      await navigate("/drawing-review", { state: { sheets }})
    } catch (e) {
      localStorageData.status = 'error';
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));
      window.alert("処理に失敗したため、画面を切り替えます");
      navigate("/drawing-review-upload-excel");
    }
  }

  type Row = Record<string, string | number | boolean | null>;
  const matchesCondition = (row: Row): boolean => {
    return row[6] === "可";
  };
  const [validation01, setValidation01] = useState<string[]>([]);
  const [validation02, setValidation02] = useState<string[]>([]);

  useEffect(() => {
    setValidation01([])
    setValidation02([])
    if (sheets.length > 0) {
      const targetIndex = sheets.findIndex(sheet => sheet.name ==="図面審査シート");
      const targetRows = sheets[targetIndex].rows.slice(8).filter((row) => matchesCondition(row))
      
      Object.keys(targetRows).forEach((i) => {
        if (!targetRows[i][3].endsWith('-01')) {
          setValidation01(prev => [...prev, targetRows[i]])
        }
        if (!targetRows[i][7].endsWith('-02')) {
          setValidation02(prev => [...prev, targetRows[i]])
        }
      })
    }
  }, [sheets])

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>図面審査</h1>
        <Link to="/hub">前に戻る</Link>
      </div>

      <h3>図面審査シートのアップロード</h3>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept=".xlsx" onChange={handleSetExcelFile} />
          </label>
        </div>

        {validation01.length > 0  && (
        <div style={{ color: 'red', border: '1px solid red', padding: '10px'}}>
          <ul><li>指摘先の図番の末尾に「-01」が無いようです。</li><ul>{validation01.map((i) => (<li>No:{i[0]} {i[3]}</li>))}</ul></ul>
        </div>
        )}

        {validation02.length > 0  && (
        <div style={{ color: 'red', border: '1px solid red', padding: '10px'}}>
          <ul><li>反映先の図番の末尾に「-02」が無いようです。</li><ul>{validation02.map((i) => (<li>No:{i[0]} {i[7]}</li>))}</ul></ul>
        </div>
        )}
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
        <button className="primary" onClick={handleStart}  disabled={excelFile.length === 0 || validation01.length > 0 || validation02.length > 0}>アップロード</button>
      </div>
    </div>
  )
}
