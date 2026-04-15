import React, { useEffect, useRef, useState, ChangeEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createLabelApi } from '../../api/createLabelApi.ts';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import type { CreateLabelResponse } from '../../types/createLabel.ts';
import Papa  from 'papaparse';
import { UploadPairRequest } from '../../types/uploadServer.ts';
import type { DraftRect, HandleDirection, InteractionMode, RectModel } from './compare/types.ts';
import { Geometry } from './compare/services/Geometry.ts';
import { RectManipulator } from './compare/services/RectManipulator.ts';
import { RectFactory } from './compare/services/RectFactory.ts';

const DEFAULT_EPIC = 'create-label';
const DEFAULT_OPERATION = 'batch-update-label';

type Row = Record<string, string | number | boolean | null>;

export const UpdateLabelScreen: React.FC = () => {
  const location = useLocation();
  const data = location.state as { currentImageFile?: { fileName?: string; url?: string } } | undefined;
  // ラベル付与済みの図面と矩形の座標
  // const labelImg = data.labelImg;
  // const rects = data.rects;
  // const labelData = data.labelData;

  const navigate = useNavigate();

  // image
  const [imageFile, setImageFile] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // 矩形編集
  const [rects, setRects] = useState<RectModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('idle');
  const [activeHandle, setActiveHandle] = useState<HandleDirection | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [initialRectState, setInitialRectState] = useState<RectModel | null>(null);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [zoom, setZoom] = useState<number>(1);

  const geometryRef = useRef(new Geometry());
  const manipulatorRef = useRef(new RectManipulator(geometryRef.current));
  const factoryRef = useRef(new RectFactory());
  const imageRef = useRef<HTMLImageElement>(null);

  // csv
  const [csvFile, setCsvFile] = useState<File[]>([]);
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);

  // ローカルストレージの削除ボタン用
  const handleRemoveItem = () => {
    navigate('/hub')
  };

  const getRelativePos = (event: React.MouseEvent) =>
    geometryRef.current.toPercent(imageRef.current, event.clientX, event.clientY);

  const handleSetFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setImageFile([selectedFile]);
      setImagePreview(URL.createObjectURL(selectedFile));
      setRects([]);
      setSelectedId(null);
      setDraftRect(null);
      setInteractionMode('idle');
    } else {
      setImageFile([]);
      setImagePreview(null);
      setRects([]);
      setSelectedId(null);
      setDraftRect(null);
      setInteractionMode('idle');
    }
  };

  const handleBackgroundMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!imagePreview || event.button !== 0) return;
    const pos = getRelativePos(event);
    setSelectedId(null);
    setInteractionMode('drawing');
    setStartPos(pos);
    setDraftRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleRectMouseDown = (event: React.MouseEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    setSelectedId(id);
    setInteractionMode('moving');
    setStartPos(getRelativePos(event));
    setInitialRectState(rects.find((rect) => rect.id === id) || null);
  };

  const handleHandleMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    id: string,
    handle: HandleDirection
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    setSelectedId(id);
    setInteractionMode('resizing');
    setActiveHandle(handle);
    setStartPos(getRelativePos(event));
    setInitialRectState(rects.find((rect) => rect.id === id) || null);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!imagePreview || interactionMode === 'idle') return;

    const currentPos = getRelativePos(event);

    if (interactionMode === 'drawing') {
      setDraftRect(manipulatorRef.current.buildDraft(startPos, currentPos));
      return;
    }

    if (interactionMode === 'moving' && initialRectState && selectedId) {
      const moved = manipulatorRef.current.move(
        [initialRectState],
        selectedId,
        initialRectState,
        startPos,
        currentPos
      )[0];

      setRects((prev) =>
        prev.map((rect) =>
          rect.id === selectedId
            ? {
                ...rect,
                x: moved.x,
                y: moved.y,
                width: moved.width,
                height: moved.height,
              }
            : rect
        )
      );
      return;
    }

    if (interactionMode === 'resizing' && initialRectState && selectedId && activeHandle) {
      const resized = manipulatorRef.current.resize(
        [initialRectState],
        selectedId,
        initialRectState,
        activeHandle,
        startPos,
        currentPos
      )[0];

      setRects((prev) =>
        prev.map((rect) =>
          rect.id === selectedId
            ? {
                ...rect,
                x: resized.x,
                y: resized.y,
                width: resized.width,
                height: resized.height,
              }
            : rect
        )
      );
    }
  };

  const handleMouseUp = () => {
    if (interactionMode === 'drawing' && manipulatorRef.current.shouldPersist(draftRect)) {
      const nextRect = factoryRef.current.create('source', draftRect);
      setRects((prev) => [...prev, nextRect]);
      setSelectedId(nextRect.id);
    }

    setInteractionMode('idle');
    setDraftRect(null);
    setInitialRectState(null);
    setActiveHandle(null);
  };

  const handleDeleteRect = (id: string) => {
    setRects((prev) => prev.filter((rect) => rect.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    handleDeleteRect(selectedId);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(3, Number((prev + 0.1).toFixed(2))));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))));

  const handleSetCsvFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      
      const selectedFile = files[0];
      const text = await selectedFile.text()
      const result = Papa.parse<Row>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });
      const data = result.data ?? [];
      setCsvRows(data);
      setCsvColumns(data.length ? Object.keys(data[0]) : []);
      setCsvFile([selectedFile]);
    } else {
      setCsvFile([]);
    }
  };


  const handleStart = async () => {
    // ローカルストレージの取得
    const getLocalStorage = window.localStorage.getItem(localStorageKey.createLabel);
    if (!getLocalStorage) {
      window.alert("処理に失敗したため、画面を切り替えます");
      navigate("/");
      return
    }
    const localStorageData: LocalStorageData = JSON.parse(getLocalStorage);
    localStorageData.epic = DEFAULT_EPIC
    localStorageData.operation = DEFAULT_OPERATION
    localStorageData.status = 'start'
    window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData))
  
    if (!localStorageData.operationId) {
      return
    }

    try {
      // 画像のアップロード
      const requestPayload: UploadPairRequest = {
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: 'doing',
        number: 1,
        files: imageFile.concat(csvFile),
      };
      await uploadApi.uploadPair(requestPayload);

      // 実行中画面に切り替え
      navigate('/update-label-processing');

      // バッチ処理実行
      let res: CreateLabelResponse;
      res = await createLabelApi.updateLabelStart({
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: localStorageData.status
      });
    } catch (e) {
      localStorageData.status = 'error';
      window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData));
      window.alert("バッチ処理起動に失敗したため、画面を切り替えます")
      navigate("/update-label")
    }
  }

  useEffect(() => {
    const initialImageUrl = data?.currentImageFile?.url;
    if (!initialImageUrl) {
      return;
    }

    let canceled = false;
    setImagePreview(initialImageUrl);

    // 結果画面から遷移した画像URLを、既存アップロード処理に渡せる File へ変換して保持する。
    void (async () => {
      try {
        const res = await fetch(initialImageUrl);
        if (!res.ok) return;
        const blob = await res.blob();
        if (canceled) return;

        const fallbackName = `update-label-${Date.now()}.jpg`;
        const fileName = data?.currentImageFile?.fileName || fallbackName;
        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
        setImageFile([file]);
      } catch {
        // 変換に失敗した場合でもプレビュー表示は維持する。
      }
    })();

    return () => {
      canceled = true;
    };
  }, [data]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>ラベル付与_修正内容反映後用</h1>
      </div>
      <ul>
        <li>修正内容を反映した図面とCSVをそれぞれ1枚ずつアップロードしてください。</li>
        <li>図面上ではドラッグで矩形追加、選択中矩形の移動・リサイズ・削除ができます。</li>
        <li>想定
          <ul>
            <li>CSVは.csvの拡張子であること</li>
            <li>図面が画像形式ファイル(JPAGやPNGなど)。</li>
          </ul>
        </li>
      </ul>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <span>画像ファイル</span>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept="image/*" onChange={handleSetFile} />
          </label>
          <span>CSVファイル</span>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept=".csv" onChange={handleSetCsvFile} />
          </label>
        </div>
      </div>

      <h3>プレビュー</h3>

      {imagePreview && (
        <div style={{ marginBottom: '15px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 14, color: '#1e293b' }}>編集キャンバス</strong>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                className="primary"
                onClick={handleZoomOut}
                style={{ fontSize: 12, padding: '6px 8px', minWidth: 32 }}
              >
                −
              </button>
              <span style={{ fontSize: 12, color: '#64748b', minWidth: 50, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="primary"
                onClick={handleZoomIn}
                style={{ fontSize: 12, padding: '6px 8px', minWidth: 32 }}
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="primary"
              onClick={handleDeleteSelected}
              disabled={!selectedId}
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              削除
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setRects([]);
                setSelectedId(null);
              }}
              disabled={rects.length === 0}
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              全削除
            </button>
          </div>

          <div
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              overflow: 'auto',
              background: '#e2e8f0',
              maxHeight: '85vh',
              padding: 12,
            }}
          >
            <div
              style={{
                position: 'relative',
                display: 'inline-block',
                background: '#fff',
                boxShadow: '0 8px 20px rgba(15, 23, 42, 0.12)',
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
              onMouseDown={handleBackgroundMouseDown}
            >
              <img
                ref={imageRef}
                src={imagePreview}
                alt='プレビュー'
                style={{
                  display: 'block',
                  width: '100%',
                  maxWidth: 2400,
                  objectFit: 'contain',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />

              {rects.map((rect, index) => {
                const isSelected = rect.id === selectedId;
                return (
                  <div
                    key={rect.id}
                    onMouseDown={(event) => handleRectMouseDown(event, rect.id)}
                    style={{
                      position: 'absolute',
                      left: `${rect.x}%`,
                      top: `${rect.y}%`,
                      width: `${rect.width}%`,
                      height: `${rect.height}%`,
                      border: isSelected ? '2px solid #2563eb' : '2px solid #64748b',
                      background: isSelected ? 'rgba(37, 99, 235, 0.16)' : 'rgba(100, 116, 139, 0.16)',
                      cursor: 'move',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: -12,
                        left: -12,
                        minWidth: 22,
                        height: 22,
                        borderRadius: 11,
                        background: isSelected ? '#2563eb' : '#64748b',
                        color: '#fff',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        padding: '0 6px',
                      }}
                    >
                      {index + 1}
                    </div>

                    {isSelected &&
                      (['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                        <div
                          key={`${rect.id}-${handle}`}
                          onMouseDown={(event) => handleHandleMouseDown(event, rect.id, handle)}
                          style={{
                            position: 'absolute',
                            width: 10,
                            height: 10,
                            background: '#fff',
                            border: '1px solid #0f172a',
                            ...(handle === 'nw' ? { top: -5, left: -5, cursor: 'nw-resize' } : {}),
                            ...(handle === 'ne' ? { top: -5, right: -5, cursor: 'ne-resize' } : {}),
                            ...(handle === 'sw' ? { bottom: -5, left: -5, cursor: 'sw-resize' } : {}),
                            ...(handle === 'se' ? { bottom: -5, right: -5, cursor: 'se-resize' } : {}),
                          }}
                        />
                      ))}
                  </div>
                );
              })}

              {interactionMode === 'drawing' && draftRect && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${draftRect.x}%`,
                    top: `${draftRect.y}%`,
                    width: `${draftRect.width}%`,
                    height: `${draftRect.height}%`,
                    border: '2px dashed #3b82f6',
                    background: 'rgba(59, 130, 246, 0.1)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          </div>

          <div style={{ fontSize: 13, color: '#475569' }}>
            使い方: 画像の空き領域をドラッグで矩形追加。矩形クリックで選択、ドラッグで移動、四隅でリサイズ、削除ボタンで削除。
          </div>

          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              background: '#f8fafc',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: 700,
                fontSize: 12,
                color: '#64748b',
              }}
            >
              矩形一覧
            </div>

            <div style={{ maxHeight: 240, overflow: 'auto' }}>
              {rects.length === 0 ? (
                <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>
                  まだ矩形がありません。
                </div>
              ) : (
                rects.map((rect, index) => {
                  const isSelected = selectedId === rect.id;
                  return (
                    <div
                      key={rect.id}
                      onClick={() => setSelectedId(rect.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderBottom: '1px solid #e2e8f0',
                        background: isSelected ? '#dbeafe' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ minWidth: 28, fontWeight: 700 }}>#{index + 1}</div>
                      <div style={{ flex: 1, fontSize: 12, color: '#64748b' }}>
                        {Math.round(rect.width)}% x {Math.round(rect.height)}%
                      </div>
                      <button
                        type="button"
                        className="primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteRect(rect.id);
                        }}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                      >
                        削除
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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
        <button className="primary" onClick={handleRemoveItem} style={{ fontSize: 13, padding: '8px 16px' }}>ホームに戻る</button>
        <button className="primary" onClick={handleStart} disabled={imageFile.length === 0 || csvFile.length === 0} style={{ fontSize: 13, padding: '8px 16px' }}>処理開始</button>
      </div>

    </div>
  );
};
