import React, { useState, ChangeEvent, useRef, useEffect } from 'react'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ImageFile, ImagePair, DrawingReviewResponse } from '../../types/drawingReview.ts';
import { drawingReviewApi } from '../../api/drawingReviewApi.ts';

const DEFAULT_EPIC = 'drawing-review';
const DEFAULT_OPERATION = 'upload-images';

type Row = Record<string, string | number | boolean | null>;

export const DrawingReviewScreen: React.FC = () => {

  const navigate = useNavigate();

  // アップロードしたExcelの中身
  const location = useLocation();
  const data = location.state;
  console.log("確認", data)
  const targetSheet = data.sheets[0]

  const matchesCondition = (row: Row): boolean => {
    return (row[4] === '〇' || row[4] === '△') && row[5] === '済' && row[2] !== "全体" && row[2] !== "-";
  };

  const filtered = targetSheet.rows.filter((row) => matchesCondition(row));

  const uniques = Array.from(
    new Set(
      filtered
        .map((r) => r[2])
    )
  );

  const [imageFile, setImageFile] = useState<File[]>([]);

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [validationMessage, setValidationMessage] = useState<string>('');

  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceIndexRef = useRef<number | null>(null);

  const handleSetImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setImageFile(prev => [...prev, ...files]);
    e.target.value = "";
  };

  const handleImageFileReplace = (index: number) => {
    replaceIndexRef.current = index;
    replaceInputRef.current?.click();
  };

  const handleImageFileRemove = (index: number) => {
    setImageFile((prev) => prev.filter((_, i) => i !== index));
  };

  const onReplaceOne = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const i = replaceIndexRef.current;

    if (!file || i == null) return;

    setImageFile((prev) => {
      const next = [...prev];
      next[i] = file;
      return next;
    });

    e.target.value = "";
    replaceIndexRef.current = null;
  };

  const handleStart = async () => {
    // ローカルストレージの取得
    const toPersist =JSON.parse(window.localStorage.getItem(localStorageKey.default) as string);
    
    // ローカルストレージのステータスをdoingに変更
    toPersist.status = 'doing'
    window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));

    try {
      // 画像のアップロード
      for (let i = 0; i < imagePairs.length; i++) {
        const files: File[] = [imagePairs[i].image1, imagePairs[i].image2]
        const requestPayload = {
          user: 'demo-user',
          epic: toPersist.lastEpic,
          operation: DEFAULT_OPERATION,
          operation_id: toPersist.operationId,
          status: toPersist.status,
          number: i+1,
          files: files
        };
        const response = await uploadApi.uploadPair(requestPayload);
      }
      toPersist.status = 'start'
      window.localStorage.setItem(localStorageKey.default, JSON.stringify(toPersist));

      // 実行中画面に切り替え
      navigate("/drawing-review-processing")

      let res: DrawingReviewResponse;
      res = await drawingReviewApi.drawingReviewStart({
        user: 'demo-user',
        epic: DEFAULT_EPIC,
        operation: 'batch-drawing-review',
        operation_id: toPersist.operationId,
        status: toPersist.status,
      })
    } catch (err) {
      window.alert("バッチ処理起動に失敗したため、画面を切り替えます")
      const sheets = data.sheets
      navigate("/drawing-review", { state: { sheets }})
    }

  }

  // ファイル名からベース部分とバージョンを抽出
  const parseFileName = (fileName: string): { base: string; version: number } | null => {
    const match = fileName.match(/^(.+?)_(\d+)\.(jpg|jpeg|png|gif)$/i)

    if (!match) return null;

    return {
      base: match[1],
      version: parseInt(match[2], 10)
    };
  };

  // ファイル名からベース部分とバージョンを抽出
  const parseExcelRowFileName = (fileName: string): { base: string; version: number } | null => {
    const match = fileName.match(/^(.+?)_(\d+)$/i)

    if (!match) return null;

    return {
      base: match[1],
      version: parseInt(match[2], 10)
    };
  };

  const [imagePairs, setImagePairs] = useState<ImagePair[]>([])

  useEffect(() => {
    const u =
      new Set(
        imagePairs
          .map((r) => r.excel)
    );
    
    const un = uniques.filter(item => !u.has(item))

    if (un.length > 0) {
      setErrorMessage(`以下に関する図面がアップロードされていません。: ${un.join(', ')}`)
    } else {
      setErrorMessage('')
    }
  }, [imagePairs])

  // 画像のペアリング
  useEffect(() =>{
    const pairs: ImagePair[] = [];
    const groupedImages: { [key: string]: ImageFile[] } = {};

    imageFile.forEach((img) => {
      const parsed = parseFileName(img.name);
      if (parsed) {
        if (!groupedImages[parsed.base]) {
          groupedImages[parsed.base] = [];
        }
        groupedImages[parsed.base].push(img);
      }

    });

    Object.keys(groupedImages).forEach((base) => {
      const group = groupedImages[base];

      group.sort((a, b) => {
        const versionA = parseFileName(a.name)?.version || 0;
        const versionB = parseFileName(b.name)?.version || 0;
        return versionA - versionB
      })
      
      for (let i = 0; i< group.length -1; i+= 2) {
        const excel = uniques.find((row) => {
          const r = parseExcelRowFileName(row)?.base;
          return r === base
        })
        const versionA = parseFileName(group[i].name)?.version || 0
        const versionB = parseFileName(group[i + 1].name)?.version || 0

        pairs.push({
          base: base,
          image1: group[i],
          image2: group[i + 1],
          excel: excel,
          checkVersion: versionB - versionA
        })
      }
      
    })
    setImagePairs(pairs)
  }, [imageFile])


  useEffect(() => {
    const fileNames = imageFile.map(img => img.name);

    const uniqueNames = new Set(fileNames);

    if (uniqueNames.size !== fileNames.length) {
      const duplicates = fileNames.filter((item, index) => fileNames.indexOf(item) !== index);
      setValidationMessage(`以下のファイル名が重複しています: ${duplicates.join(', ')}`)
    } else {
      setValidationMessage('')
    }
  }, [imageFile])


  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>図面審査</h1>
      </div>

      <h3>Excel</h3>
      <ul>
        <li>アップロードしたExcelの中で以下に該当するレコードのみを表示しています。</li>
          <ul>
            <li>「採用可否」が〇もしくは△であり</li>
            <li>「図面反映」が済であり</li>
            <li>「図番」が全体もしくは-ではない</li>
          </ul>
      </ul>

      {targetSheet && (
        <div style={{ marginTop: 12, overflowX: 'auto' }} className='table-wrapper' >
          <table
            style={{
              borderCollapse: 'collapse',
              minWidth: 600,
            }}
          >
            <tbody className='table-row' >
              {filtered.map((row, rIdx) => (
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
          </div>)
          }
        

      <h3>画像アップロード</h3>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" multiple accept="image/*" onChange={handleSetImageFile} />
          </label>
        </div>

        
        {errorMessage && (
          <p style={{ color: 'red', border: '1px solid red', padding: '10px'}}>{errorMessage}</p>
        )}

        {validationMessage && (
          <p style={{ color: 'red', border: '1px solid red', padding: '10px'}}>{validationMessage}</p>
        )}

        <ul style={{ padding: 0 }}>
          {imageFile.map((file, i) => (
            <li style={{ listStyle: "none", margin: 2 }} key={i}>
              <strong>{file.name}</strong>{" "}
              <button type="button" onClick={() => handleImageFileReplace(i)}>別ファイルへ変更</button>{" "}
              <button type="button" onClick={() => handleImageFileRemove(i)}>削除</button>
            </li>
          ))}
        </ul>
        <input ref={replaceInputRef} type="file" accept="image/*" onChange={onReplaceOne} style={{ display: "none" }}/>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleStart}  disabled={errorMessage !== '' || validationMessage !== ''}>処理開始</button>
      </div>
    </div>
  )
}
