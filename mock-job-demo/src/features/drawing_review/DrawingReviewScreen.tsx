import React, { useState, ChangeEvent, useRef, useEffect } from 'react'
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ImagePair, DrawingReviewResponse } from '../../types/drawingReview.ts';
import { drawingReviewApi } from '../../api/drawingReviewApi.ts';

const DEFAULT_EPIC = 'drawing-review';
const DEFAULT_OPERATION = 'upload-images';

type Row = Record<string, string | number | boolean | null>;

export const DrawingReviewScreen: React.FC = () => {

  const navigate = useNavigate();

  // アップロードしたExcelの中身
  const location = useLocation();
  const data = location.state;

  // 「図面審査シート」に絞る
  const targetIndex = data.sheets.findIndex(sheet => sheet.name ==="図面審査シート");
  const targetSheet = data.sheets[targetIndex]

  const matchesCondition = (row: Row): boolean => {
    return row[6] === "可";
  };

  const filtered = targetSheet.rows.filter((row) => matchesCondition(row));

  const old_uniques = Array.from(
    new Set(
      filtered
        .map((r) => r[3])
    )
  );

  const new_uniques = Array.from(
    new Set(
      filtered
        .map((r) => r[7])
    )
  );

  const all_uniques = [...old_uniques, ...new_uniques]

  const [imageFile, setImageFile] = useState<File[]>([]);

  const [validationMessage01, setValidationMessage01] = useState<string[]>([]);
  const [validationMessage02, setValidationMessage02] = useState<string[]>([]);
  const [validationMessage03, setValidationMessage03] = useState<string[]>([]);
  const [validationMessage04, setValidationMessage04] = useState<string[]>([]);

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
    const getLocalStorage = window.localStorage.getItem(localStorageKey.drawingReview)
    if (!getLocalStorage) {
      window.alert("処理に失敗したため、画面を切り替えます");
      navigate("/drawing-review-upload-excel");
      return
    }
    
    // ローカルストレージの値を変更
    const localStorageData: LocalStorageData  = JSON.parse(getLocalStorage);
    localStorageData.epic = DEFAULT_EPIC
    localStorageData.operation = DEFAULT_OPERATION
    localStorageData.status = 'start'
    window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));

    if (!localStorageData.operationId) {
      return
    }

    try {
      // アップロード
      for (let i = 0; i < imagePairs.length; i++) {
        localStorageData.status = "doing";
        window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));
        const files: File[] = [imagePairs[i].image1, imagePairs[i].image2]
        const requestPayload = {
          user: localStorageData.user,
          epic: localStorageData.epic,
          operation: localStorageData.operation,
          operation_id: localStorageData.operationId,
          status: localStorageData.status,
          number: i+1,
          files: files
        };
        await uploadApi.uploadPair(requestPayload);
      }
      
      localStorageData.status = 'end';

      // ローカルストレージの値を変更
      localStorageData.status = 'start'
      localStorageData.operation = 'batch-drawing-review'
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));

      // 実行中画面に切り替え
      navigate("/drawing-review-processing")

      let res: DrawingReviewResponse;
      res = await drawingReviewApi.drawingReviewStart({
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: localStorageData.status,
      })
    } catch (e) {
      localStorageData.status = 'error';
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(localStorageData));
      window.alert("バッチ処理起動に失敗したため、画面を切り替えます");
      navigate("/drawing-review-upload-excel");
    }
  }

  const [imagePairs, setImagePairs] = useState<ImagePair[]>([])

  const compareFileLists = (listA: string[], listB: string[]): void => { 
    setValidationMessage01([])   
    setValidationMessage02([])
    setValidationMessage03([])
    const listA01 = listA.filter(s => s.endsWith("-01"));
    const listA02 = listA.filter(s => s.endsWith("-02"));
    const listB01 = listB.filter(s => s.endsWith("-01"));
    const listB02 = listB.filter(s => s.endsWith("-02"));
    const setA = new Set(listA);
    const setA01 = new Set(listA01);
    const setA02 = new Set(listA02);
    const setB = new Set(listB);
    const setB01 = new Set(listB01);
    const setB02 = new Set(listB02);

    for (const name of setB01) {
      if (!setA01.has(name)) {
        setValidationMessage01(prev => [...prev, name])
      }
    }

    for (const name of setB02) {
      if (!setA02.has(name)) {
        setValidationMessage02(prev => [...prev, name])
      }
    }

    for (const name of setA) {
      if (!setB.has(name)) {
        setValidationMessage03(prev => [...prev, name])
      }
    }
  }

  // 新しく作成するロジック,画像がセットされた段階で動く
  // Excelのファイル名部分を抜き出す
  useEffect(() => {
    setImagePairs([])
    const fileNames = imageFile.map(img => img.name.replace(/\.pdf$/i, ""));

    compareFileLists(fileNames, all_uniques)

    // ペアを作る
    const pairs: ImagePair[] = [];
    Object.keys(filtered).forEach((i) => {
      const image01 = imageFile.find((row) => {
        const name = row.name.replace(/\.pdf$/i, "")
        return name === filtered[i][3]
      })
      const image02 = imageFile.find((row) => {
        const name = row.name.replace(/\.pdf$/i, "")
        return name === filtered[i][7]
      })
      if (image01 && image02) {
        pairs.push({
          no: filtered[i][0],
          image1: image01,
          image2: image02
        })
      }
    })
    setImagePairs(pairs)
  }, [imageFile])

  useEffect(() => {
    setValidationMessage04([])
    const fileNames = imageFile.map(img => img.name);

    const uniqueNames = new Set(fileNames);

    if (uniqueNames.size !== fileNames.length) {
      const duplicates = fileNames.filter((item, index) => fileNames.indexOf(item) !== index);
      setValidationMessage04(duplicates)
    } else {
      setValidationMessage04([])
    }
  }, [imageFile])

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>図面審査</h1>
      </div>

      <h3>アップロードした図面審査シート</h3>
      <ul>
        <li>アップロードした図面審査シートの中で、以下に該当するものを表示しています。</li>
          <ul>
            <li>「採用可否」が可である</li>
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
        

      <h3>図面アップロード</h3>
      <p>図面審査シートに問題がなければ、対応する図面をアップロードしてください。</p>
      <p>必要な図面が選択されないと処理開始ボタンが機能しないようにしています。</p>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" multiple accept="application/pdf" onChange={handleSetImageFile} />
          </label>
        </div>

        {validationMessage01.length > 0  && (
        <div style={{ color: 'red', border: '1px solid red', padding: '10px'}}>
          <ul><li>以下の指摘先図面を選択してください。</li><ul>{validationMessage01.map((i) => (<li>{i}</li>))}</ul></ul>
        </div>
        )}
        {validationMessage02.length > 0  && (
        <div style={{ color: 'red', border: '1px solid red', padding: '10px'}}>
          <ul><li>以下の指摘反映図面を選択してください。</li><ul>{validationMessage02.map((i) => (<li>{i}</li>))}</ul></ul>
        </div>
        )}
        {validationMessage03.length > 0  && (
        <div style={{ color: 'red', border: '1px solid red', padding: '10px'}}>
          <ul><li>以下の図面は不要であるため、選択から削除してください。</li><ul>{validationMessage03.map((i) => (<li>{i}</li>))}</ul></ul>
        </div>
        )}
        {validationMessage04.length > 0  && (
        <div style={{ color: 'red', border: '1px solid red', padding: '10px'}}>
          <ul><li>ファイルが重複しています。</li><ul>{validationMessage04.map((i) => (<li>{i}</li>))}</ul></ul>
        </div>
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
        <input ref={replaceInputRef} type="file" accept="application/pdf" onChange={onReplaceOne} style={{ display: "none" }}/>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleStart}  disabled={validationMessage01.length > 0 || validationMessage02.length > 0|| validationMessage03.length > 0 || validationMessage04.length > 0}>処理開始</button>
      </div>
    </div>
  )
}
