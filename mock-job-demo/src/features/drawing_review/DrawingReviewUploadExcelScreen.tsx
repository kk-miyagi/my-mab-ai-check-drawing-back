import React, { useState, ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { PersistedState } from '../../types/uploadContext.ts';
import { OperationIssueRequest } from '../../types/upload.ts';
import { issueOperationId } from '../../components/upload/issueOperationId.ts';
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
    }
  };


  const handleStart = async () => {
    // ローカルストレージの初期化
    const toPersist: PersistedState = {
      phase: 'idle',
      progress: 0,
      completedRequests: 0,
      totalRequests: 0,
      failedUploads: [],
      logs: [],
      operationId: null,
      resultData: null,
      lastEpic: null,
      lastOperation: null,
      status: 'start',
      demoFlag: false
    }
    window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(toPersist));
    
    // ローカルストレージのステータスをdoingに変更
    toPersist.phase = 'issuing_id'
    toPersist.status = 'doing'
    toPersist.lastEpic = DEFAULT_EPIC
    toPersist.lastOperation = DEFAULT_OPERATION
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));

    // オペレーションIDの発行
    const DEFAULT_USER = (import.meta.env?.VITE_UPLOAD_USER as string | undefined) ?? 'demo-user';
    const metaPayload: OperationIssueRequest = {
      user: DEFAULT_USER,
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
      operation_id: null,
      status: 'start',
    };
    const issueResult = await issueOperationId(metaPayload);
    toPersist.operationId = issueResult.operation_id
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));

    // 画像のアップロード
    const requestPayload = {
      user: metaPayload.user,
      epic: metaPayload.epic,
      operation: metaPayload.operation,
      operation_id: issueResult.operation_id,
      status: toPersist.status,
      number: 1,
      files: excelFile,
    };
    const response = await uploadApi.uploadPair(requestPayload);
    console.log("/multi-file-uploadのレスポンス:", response)

    console.log("sheetsの中身", sheets)
    await navigate("/drawing-review", { state: { sheets }})

  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>図面審査</h1>
        <Link to="/hub">前に戻る</Link>
      </div>

      <h3>Excelアップロード</h3>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept=".xlsx" onChange={handleSetExcelFile} />
          </label>
        </div>
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
                background: idx === activeIndex ? '#eef' : '#fff',
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
              {sheets[activeIndex].rows.map((row, rIdx) => (
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
        <button className="primary" onClick={handleStart}  disabled={excelFile.length === 0}>アップロード</button>
      </div>
    </div>
  )
}
