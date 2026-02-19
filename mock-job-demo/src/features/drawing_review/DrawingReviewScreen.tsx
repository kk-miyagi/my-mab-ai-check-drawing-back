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

  const targetSheet = data.sheets[0]

  const matchesCondition = (row: Row): boolean => {
    return row[6] === "可";
  };

  const filtered = targetSheet.rows.filter((row) => matchesCondition(row));

  const uniques = Array.from(
    new Set(
      filtered
        .map((r) => r[3])
    )
  );

  const [imageFile, setImageFile] = useState<File[]>([]);

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [validationMessage2, setValidationMessage2] = useState<string>('');
  const [validationMessage3, setValidationMessage3] = useState<string[]>([]);
  const [checkId, setCheckId] = useState<string[]>([]);

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
    const toPersist =JSON.parse(window.localStorage.getItem(localStorageKey.drawingReview) as string);
    
    // ローカルストレージのステータスをdoingに変更
    toPersist.status = 'doing'
    window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(toPersist));

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
      toPersist.lastOperation = 'batch-drawing-review'
      window.localStorage.setItem(localStorageKey.drawingReview, JSON.stringify(toPersist));

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
    const match = fileName.match(/^(.+?)_(\d+)\.(jpg|jpeg|png|gif|pdf)$/i)

    if (!match) return null;

    return {
      base: match[1],
      version: parseInt(match[2], 10)
    };
  };

  // ファイル名からベース部分とバージョンを抽出(Excel側)
  const parseExcelRowFileName = (fileName: string): { base: string; version: number } | null => {
    const match = fileName.match(/^(.+?)_(\d+)$/i)

    if (!match) return null;

    return {
      base: match[1],
      version: parseInt(match[2], 10)
    };
  };


  const difference = (A: string[], B: string[]): string[] => {
    const setB = new Set(B);
    return A.filter(a => !setB.has(a));
  };


  const [imagePairs, setImagePairs] = useState<ImagePair[]>([])

  useEffect(() => {
    const u =
      new Set(
        imagePairs
          .map((r) => r.excel)
    );
    
    const un = uniques.filter(item => !u.has(item))
    
    const baseUn = un.map(i => parseExcelRowFileName(i)?.base)
    console.log(baseUn)

    const check_un = difference(baseUn, checkId)

    if (check_un.length > 0) {
      setErrorMessage(`修正前後の図面がどちらも選択されていません。: ${check_un.join(', ')}`)
    } else {
      setErrorMessage('')
    }
  }, [imagePairs])

  // 画像のペアリング
  useEffect(() =>{
    setValidationMessage3([])
    setCheckId([])
    const pairs: ImagePair[] = [];
    const groupedImages: { [key: string]: ImageFile[] } = {};

    // 付与なファイルを除外する(後続処理のため)
    const excel = uniques.map(row => parseExcelRowFileName(row)?.base)
    console.log(excel)
    const filteredFiles = imageFile.filter(file => {
      const hasKeyword = excel.some(keyword => file.name.includes(keyword))
      return hasKeyword
    })

    console.log("中身を確認filteredFiles: ", filteredFiles)


    // ファイル名の図番ごとにリストにする。(バージョンは除く)
    filteredFiles.forEach((img) => {
      const parsed = parseFileName(img.name);
      if (parsed) {
        if (!groupedImages[parsed.base]) {
          groupedImages[parsed.base] = [];
        }
        groupedImages[parsed.base].push(img);
      }
    });

    // ここで組になったファイルのうち、Excel側にあるかどうかを判定する処理を追加する。あればバージョン比較を行う
    Object.keys(groupedImages).forEach((base) => {
      const group = groupedImages[base];
      console.log("groupの確認", group)

      // groupのファイル名のバージョンとExcelのバージョンが一緒の場合、アップデート後の方がない
      if (group.length < 2) {
        const excel = uniques.find((row) => {
          const r = parseExcelRowFileName(row)?.base;
          return r === base
        })
        const imageVer = parseFileName(group[0].name)?.version
        const excelVer = parseExcelRowFileName(excel)?.version
        if (imageVer === excelVer) {
          setValidationMessage3(prev => [...prev, `${base}: 指摘反映後の図面がありません`])
          setCheckId(prev => [...prev, base])
        }
        if (imageVer > excelVer) {
          setValidationMessage3(prev => [...prev, `${base}: 指摘反映前の図面がありません`])
          setCheckId(prev => [...prev, base])
        }
        if (imageVer < excelVer) {
          setValidationMessage3(prev => [...prev, `${base}: 図面審査シートに記載されているバージョンより古いようです。`])
          setCheckId(prev => [...prev, base])
        }
      }

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

  useEffect(() => {
    const fileNames = imageFile.map(img => img.name);
    const excel = uniques.map(row => parseExcelRowFileName(row)?.base)
    const filteredFiles: string[] = fileNames.filter(file => {
      const hasKeyword = excel.some(keyword => file.includes(keyword))
      return !hasKeyword
    })
    
    if (filteredFiles.length > 0) {
      setValidationMessage2(`以下のファイルは不要です。: ${filteredFiles.join(', ')}`)
    } else {
      setValidationMessage2('')
    }
  }, [imageFile])


  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>図面審査</h1>
      </div>

      <h3>アップロードした量産図面審査シート</h3>
      <ul>
        <li>アップロードした量産図面審査シートの中で、以下に該当するものを表示しています。</li>
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
      <p>量産図面審査シートに問題がなければ、対応する図面をアップロードしてください。</p>
      <p>必要な図面が選択されないと処理開始ボタンが機能しないようにしています。</p>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" multiple accept="application/pdf" onChange={handleSetImageFile} />
          </label>
        </div>

        
        {errorMessage && (
          <p style={{ color: 'red', border: '1px solid red', padding: '10px'}}>{errorMessage}</p>
        )}

        {validationMessage && (
          <p style={{ color: 'red', border: '1px solid red', padding: '10px'}}>{validationMessage}</p>
        )}
        {validationMessage2 && (
          <p style={{ color: 'red', border: '1px solid red', padding: '10px'}}>{validationMessage2}</p>
        )}
        {validationMessage3.length > 0  && (
        <div style={{ color: 'red', border: '1px solid red', padding: '10px'}}>
          {validationMessage3.map((i) => (<p>{i}</p>))}
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
        <button className="primary" onClick={handleStart}  disabled={errorMessage !== '' || validationMessage !== ''|| validationMessage2 !== '' || validationMessage3.length > 0}>処理開始</button>
      </div>
    </div>
  )
}
