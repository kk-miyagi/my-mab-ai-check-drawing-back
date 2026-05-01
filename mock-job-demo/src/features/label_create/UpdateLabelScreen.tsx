import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import {
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { createLabelApi } from '../../api/createLabelApi.ts';
import { uploadApi } from '../../api/uploadApi.ts';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import type { CreateLabelResponse } from '../../types/createLabel.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { UploadPairRequest } from '../../types/uploadServer.ts';
import type { DraftRect, HandleDirection, InteractionMode, RectModel } from './compare/types.ts';
import { Geometry } from './compare/services/Geometry.ts';
import { RectFactory } from './compare/services/RectFactory.ts';
import { RectManipulator } from './compare/services/RectManipulator.ts';
import { Header } from '../../components/Header.tsx';

const DEFAULT_EPIC = 'create-label';
const DEFAULT_OPERATION = 'batch-update-label';
const DEFAULT_CSV_COLUMNS = ['No', '項目', '寸法値または品質指定等の記載内容', '備考'];
const HIDDEN_CSV_COLUMNS = ['理由およびエラーログ', 'No', 'No.', 'row_index'];

type Row = Record<string, string | number | boolean | null>;
type RectTuple = [number, number, number, number];

type InitFileRef = {
  name?: string;
  url?: string;
};

type UpdateLabelLocationState = {
  currentImageFile?: { fileName?: string; url?: string };
  labelImg?: InitFileRef;
  labelData?: InitFileRef;
  rects?: Record<string, RectTuple>;
};

type EditableRow = Row & {
  __rowIndex: number;
};

type RectJsonItem = {
  row_index?: unknown;
  rowIndex?: unknown;
  No?: unknown;
  rect?: unknown;
  bbox?: unknown;
  box?: unknown;
};

type InitialJsonSnapshot = {
  rects: RectModel[];
  rectRowMap: Record<string, number>;
  csvRows: EditableRow[];
};

export const UpdateLabelScreen: React.FC = () => {
  const location = useLocation();
  const data = location.state as UpdateLabelLocationState | undefined;
  const navigate = useNavigate();

  // FIXME(keep): 矩形編集・CSV編集・送信候補値の説明コメントは、引き継ぎ向けに維持すること。
  // FIXME(keep): 仕様変更があってもコメントは削除せず、実装との差分を更新する運用にする。

  // サーバーへ渡す候補値の格納場所：
  // - 設計情報: imageFile（設計画像）
  // - 座標情報: rects（各行の矩形座標情報）、rectRowMap（矩形 ID とCSV行番号の対応）
  // - 設計内容: csvRows（CSV行データ）、csvColumns（CSV列定義）
  // これらの値は主に以下の state に保持されている：
  const [imageFile, setImageFile] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [rects, setRects] = useState<RectModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('idle');
  const [activeHandle, setActiveHandle] = useState<HandleDirection | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [initialRectState, setInitialRectState] = useState<RectModel | null>(null);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rectRowMap, setRectRowMap] = useState<Record<string, number>>({});

  const geometryRef = useRef(new Geometry());
  const manipulatorRef = useRef(new RectManipulator(geometryRef.current));
  const factoryRef = useRef(new RectFactory());
  const imageRef = useRef<HTMLImageElement>(null);

  const [csvFile, setCsvFile] = useState<File[]>([]);
  const [csvRows, setCsvRows] = useState<EditableRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('update-label.csv');
  const [showRightPanel, setShowRightPanel] = useState<boolean>(false);
  const [initialJsonSnapshot, setInitialJsonSnapshot] = useState<InitialJsonSnapshot | null>(null);
  const [jsonRowIndexFloor, setJsonRowIndexFloor] = useState<number>(0);
  const loadedRectsRef = useRef(false);
  const visibleCsvColumns = csvColumns.filter((column) => !HIDDEN_CSV_COLUMNS.includes(column));

  const cloneRectList = (items: RectModel[]): RectModel[] => items.map((item) => ({ ...item }));
  const cloneRows = (rows: EditableRow[]): EditableRow[] => rows.map((row) => ({ ...row }));

  const toNumber = (value: unknown): number | null => {
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : null;
  };

  const detectRowIndex = (row: Row, fallback: number): number => {
    const rawIndex = row.row_index ?? row.No;
    const normalized = toNumber(rawIndex);
    if (normalized === null || normalized <= 0) return fallback;
    return normalized;
  };

  const createEmptyRow = (rowIndex: number, columns: string[]): EditableRow => {
    const effectiveColumns = columns.length > 0 ? columns : DEFAULT_CSV_COLUMNS;
    const row: EditableRow = { __rowIndex: rowIndex };
    for (const column of effectiveColumns) {
      row[column] = '';
    }
    if (effectiveColumns.includes('No')) {
      row.No = rowIndex;
    }
    if (effectiveColumns.includes('row_index')) {
      row.row_index = rowIndex;
    }
    return row;
  };

  const parseAndSetCsv = (text: string, fileName: string) => {
    const result = Papa.parse<Row>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    const parsedRows = result.data ?? [];
    const columns = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : DEFAULT_CSV_COLUMNS;
    const filteredColumns = columns.filter((column) => !HIDDEN_CSV_COLUMNS.includes(column));
    const normalizedRows: EditableRow[] = parsedRows.map((row, index) => ({
      ...row,
      __rowIndex: detectRowIndex(row, index + 1),
    }));

    setCsvRows(normalizedRows);
    setCsvColumns(filteredColumns);
    setCsvFileName(fileName);
  };

  const buildCsvForUpload = (): File | null => {
    const columns = (csvColumns.length > 0 ? csvColumns : DEFAULT_CSV_COLUMNS)
      .filter((column) => !HIDDEN_CSV_COLUMNS.includes(column));
    const records = [...csvRows]
      .sort((a, b) => a.__rowIndex - b.__rowIndex)
      .map((row) => {
        const record: Row = {};
        for (const column of columns) {
          record[column] = row[column] ?? '';
        }
        return record;
      });

    if (records.length === 0) {
      return null;
    }

    const csvText = Papa.unparse(records, { columns });
    return new File([csvText], csvFileName || 'update-label.csv', {
      type: 'text/csv;charset=utf-8',
    });
  };

  const getNextRowIndex = (): number => {
    const indices = [
      ...csvRows.map((row) => row.__rowIndex),
      ...Object.values(rectRowMap),
    ].filter((value) => Number.isFinite(value) && value > 0);
    const liveMax = indices.length === 0 ? 0 : Math.max(...indices);
    const baseMax = Math.max(liveMax, jsonRowIndexFloor);
    return baseMax + 1;
  };

  const getRectIdByRowIndex = (rowIndex: number): string | null => {
    for (const [rectId, linkedRowIndex] of Object.entries(rectRowMap)) {
      if (linkedRowIndex === rowIndex) {
        return rectId;
      }
    }
    return null;
  };

  const updateRectFromPixelTuple = async (
    previewUrl: string,
    incomingRects: Record<string, RectTuple>
  ): Promise<{ nextRects: RectModel[]; nextMap: Record<string, number> } | null> => {
    const image = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = previewUrl;
    });

    if (!loaded || image.naturalWidth === 0 || image.naturalHeight === 0) {
      return null;
    }

    const nextRects: RectModel[] = [];
    const nextMap: Record<string, number> = {};
    const entries = Object.entries(incomingRects)
      .map(([rowKey, tuple]) => ({ rowIndex: Number(rowKey), tuple }))
      .filter((item) => Number.isFinite(item.rowIndex))
      .sort((a, b) => a.rowIndex - b.rowIndex);

    for (const entry of entries) {
      const [x, y, width, height] = entry.tuple;
      const rowIndex = entry.rowIndex;
      const normalized = {
        x: (x / image.naturalWidth) * 100,
        y: (y / image.naturalHeight) * 100,
        width: (width / image.naturalWidth) * 100,
        height: (height / image.naturalHeight) * 100,
      };

      const rectId = `row-${rowIndex}`;
      nextRects.push({
        id: rectId,
        role: 'source',
        x: normalized.x,
        y: normalized.y,
        width: normalized.width,
        height: normalized.height,
        imageCoords: normalized,
        linkedTargetIds: [],
      });
      nextMap[rectId] = rowIndex;
    }

    setRects(nextRects);
    setRectRowMap(nextMap);
    setSelectedId(null);
    return { nextRects, nextMap };
  };

  const handleRemoveItem = () => {
    navigate('/hub');
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
      setRectRowMap({});
      setSelectedId(null);
      setDraftRect(null);
      setInteractionMode('idle');
      loadedRectsRef.current = true;
      setInitialJsonSnapshot(null);
      setJsonRowIndexFloor(0);
    } else {
      setImageFile([]);
      setImagePreview(null);
      setRects([]);
      setRectRowMap({});
      setSelectedId(null);
      setDraftRect(null);
      setInteractionMode('idle');
      setInitialJsonSnapshot(null);
      setJsonRowIndexFloor(0);
    }
  };

  const handleBackgroundMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // FIXME(keep): 矩形編集仕様（空き領域ドラッグで新規矩形作成）
    if (!imagePreview || event.button !== 0) return;
    const pos = getRelativePos(event);
    setSelectedId(null);
    setInteractionMode('drawing');
    setStartPos(pos);
    setDraftRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleRectMouseDown = (event: React.MouseEvent<HTMLDivElement>, id: string) => {
    // FIXME(keep): 矩形編集仕様（矩形クリックで選択し、ドラッグで移動）
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
    // FIXME(keep): 矩形編集仕様（四隅ハンドルでリサイズ）
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
      const nextRowIndex = getNextRowIndex();
      const columns = csvColumns.length > 0 ? csvColumns : DEFAULT_CSV_COLUMNS;
      setRects((prev) => [...prev, nextRect]);
      setRectRowMap((prev) => ({ ...prev, [nextRect.id]: nextRowIndex }));
      setCsvColumns(columns);
      setCsvRows((prev) => [...prev, createEmptyRow(nextRowIndex, columns)]);
      setSelectedId(nextRect.id);
    }

    setInteractionMode('idle');
    setDraftRect(null);
    setInitialRectState(null);
    setActiveHandle(null);
  };

  const handleDeleteRect = (id: string) => {
    // FIXME(keep): 矩形とCSV行は 1:1 対応で削除する。
    const linkedRowIndex = rectRowMap[id];
    setRects((prev) => prev.filter((rect) => rect.id !== id));
    setRectRowMap((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    if (linkedRowIndex !== undefined) {
      setCsvRows((prev) => prev.filter((row) => row.__rowIndex !== linkedRowIndex));
    }
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    handleDeleteRect(selectedId);
  };

  const handleResetToInitialJson = () => {
    if (!initialJsonSnapshot) return;
    setRects(cloneRectList(initialJsonSnapshot.rects));
    setRectRowMap({ ...initialJsonSnapshot.rectRowMap });
    setCsvRows(cloneRows(initialJsonSnapshot.csvRows));
    setSelectedId(null);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(3, Number((prev + 0.1).toFixed(2))));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))));

  const handleSetCsvFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      const text = await selectedFile.text();
      parseAndSetCsv(text, selectedFile.name);
      setCsvFile([selectedFile]);
    } else {
      setCsvFile([]);
      setCsvRows([]);
      setCsvColumns([]);
    }
  };

  const normalizeRectTuple = (rawRect: unknown): RectTuple | null => {
    if (Array.isArray(rawRect) && rawRect.length >= 4) {
      const values = rawRect.slice(0, 4).map((value) => Number(value));
      if (values.every((value) => Number.isFinite(value))) {
        const [x1, y1, v3, v4] = values;

        // JSON添付でよく使われる [x1, y1, x2, y2] と [x, y, width, height] の両方に対応する。
        if (v3 > x1 && v4 > y1) {
          return [x1, y1, v3 - x1, v4 - y1];
        }

        return [x1, y1, v3, v4];
      }
    }

    if (rawRect && typeof rawRect === 'object') {
      const rectObj = rawRect as Record<string, unknown>;
      const x = Number(rectObj.x);
      const y = Number(rectObj.y);
      const width = Number(rectObj.width);
      const height = Number(rectObj.height);
      if ([x, y, width, height].every((value) => Number.isFinite(value))) {
        return [x, y, width, height];
      }
    }

    return null;
  };

  const parseRectJson = (text: string): Record<string, RectTuple> => {
    const parsed = JSON.parse(text) as unknown;
    const rectMap: Record<string, RectTuple> = {};

    const appendRect = (rawRowIndex: unknown, rawRect: unknown, fallbackIndex: number) => {
      const rowIndex = Number(rawRowIndex ?? fallbackIndex);
      const tuple = normalizeRectTuple(rawRect);
      if (!Number.isFinite(rowIndex) || !tuple) return;
      rectMap[String(Math.trunc(rowIndex))] = tuple;
    };

    const appendFromItems = (items: RectJsonItem[]) => {
      items.forEach((item, index) => {
        appendRect(
          item.row_index ?? item.rowIndex ?? item.No,
          item.rect ?? item.bbox ?? item.box,
          index + 1
        );
      });
    };

    if (Array.isArray(parsed)) {
      appendFromItems(parsed as RectJsonItem[]);
      return rectMap;
    }

    if (parsed && typeof parsed === 'object') {
      const data = parsed as Record<string, unknown>;

      if (data.rects && typeof data.rects === 'object' && !Array.isArray(data.rects)) {
        Object.entries(data.rects as Record<string, unknown>).forEach(([rowIndex, rawRect]) => {
          appendRect(rowIndex, rawRect, Number(rowIndex));
        });
      }

      for (const key of ['final_matches', 'matches', 'items']) {
        if (Array.isArray(data[key])) {
          appendFromItems(data[key] as RectJsonItem[]);
        }
      }

      // { "1": [x,y,w,h], "2": [x,y,w,h] } 形式にも対応
      Object.entries(data).forEach(([rowIndex, rawRect]) => {
        if (rowIndex === 'rects' || rowIndex === 'final_matches' || rowIndex === 'matches' || rowIndex === 'items') {
          return;
        }
        appendRect(rowIndex, rawRect, Number(rowIndex));
      });
    }

    return rectMap;
  };

  const handleSetRectJsonFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!imagePreview) {
      window.alert('先に図面画像を読み込んでください。');
      return;
    }

    try {
      const selectedFile = files[0];
      const text = await selectedFile.text();
      const incomingRects = parseRectJson(text);

      if (Object.keys(incomingRects).length === 0) {
        window.alert('矩形情報が見つかりませんでした。JSON形式を確認してください。');
        return;
      }

      loadedRectsRef.current = true;
      const loadedState = await updateRectFromPixelTuple(imagePreview, incomingRects);
      if (!loadedState) {
        window.alert('画像サイズの取得に失敗したため、矩形を表示できませんでした。');
        return;
      }

      const rowIndexes = Object.values(loadedState.nextMap).sort((a, b) => a - b);
      const rowIndexSet = new Set(rowIndexes);
      const columns = csvColumns.length > 0 ? csvColumns : DEFAULT_CSV_COLUMNS;
      const rowByIndex = new Map(csvRows.map((row) => [row.__rowIndex, row]));
      const restoredCsvRows = rowIndexes.map((rowIndex) => {
        const existing = rowByIndex.get(rowIndex);
        return existing ? { ...existing } : createEmptyRow(rowIndex, columns);
      });

      setCsvColumns(columns);
      setCsvRows(restoredCsvRows);
      const maxLoadedIndex = rowIndexes.length > 0 ? Math.max(...rowIndexes) : 0;
      setJsonRowIndexFloor(maxLoadedIndex);
      setInitialJsonSnapshot({
        rects: cloneRectList(loadedState.nextRects),
        rectRowMap: { ...loadedState.nextMap },
        csvRows: cloneRows(restoredCsvRows),
      });

      // JSONにない行は表示対象外にして、矩形と行の対応を常に1対1で保つ。
      if (csvRows.some((row) => !rowIndexSet.has(row.__rowIndex))) {
        setCsvRows((prev) => prev.filter((row) => rowIndexSet.has(row.__rowIndex)));
      }
    } catch {
      window.alert('矩形JSONの読み込みに失敗しました。JSON形式を確認してください。');
    }
  };

  const handleStart = async () => {
    const getLocalStorage = window.localStorage.getItem(localStorageKey.createLabel);
    if (!getLocalStorage) {
      window.alert('処理に失敗したため、画面を切り替えます');
      navigate('/');
      return;
    }

    const localStorageData: LocalStorageData = JSON.parse(getLocalStorage);
    localStorageData.epic = DEFAULT_EPIC;
    localStorageData.operation = DEFAULT_OPERATION;
    localStorageData.status = 'start';
    window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData));

    if (!localStorageData.operationId) {
      return;
    }

    const generatedCsv = buildCsvForUpload();
    const fallbackCsv = csvFile.length > 0 ? csvFile[0] : null;
    const csvToUpload = generatedCsv ?? fallbackCsv;
    if (!csvToUpload) {
      window.alert('設計情報CSVが見つかりません。CSVを読み込むか編集内容を確認してください。');
      return;
    }

    try {
      // FIXME(keep): サーバー送信時は「画像+CSV」と「rects(JSON)」の両方を送る前提。
      // サーバーへ送信する候補値の組み立て
      // - 設計情報: imageFile.concat([csvToUpload]) がファイルとして送信される
      // - 座標情報: rects を JSON.stringify して rects フィールドに追加
      // - メタデータ: localStorageData から user, epic, operation, operation_id などを取得
      const requestPayload: UploadPairRequest = {
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: 'doing',
        number: 1,
        files: imageFile.concat([csvToUpload]),
        // JSON文字列で矩形座標情報をサーバーに送信
        // rects: JSON.stringify(rects),
      };
      await uploadApi.uploadPair(requestPayload);

      navigate('/update-label-processing');

      let res: CreateLabelResponse;
      res = await createLabelApi.updateLabelStart({
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: localStorageData.status,
      });
      void res;
    } catch {
      localStorageData.status = 'error';
      window.localStorage.setItem(localStorageKey.createLabel, JSON.stringify(localStorageData));
      window.alert('バッチ処理起動に失敗したため、画面を切り替えます');
      navigate('/update-label');
    }
  };

  useEffect(() => {
    const initialImageUrl = data?.labelImg?.url ?? data?.currentImageFile?.url;
    if (!initialImageUrl) {
      return;
    }

    let canceled = false;
    setImagePreview(initialImageUrl);
    loadedRectsRef.current = false;

    void (async () => {
      try {
        const res = await fetch(initialImageUrl);
        if (!res.ok) return;
        const blob = await res.blob();
        if (canceled) return;

        const fallbackName = `update-label-${Date.now()}.jpg`;
        const fileName = data?.labelImg?.name || data?.currentImageFile?.fileName || fallbackName;
        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
        setImageFile([file]);
      } catch {
        // プレビューのみ維持する。
      }
    })();

    return () => {
      canceled = true;
    };
  }, [data]);

  useEffect(() => {
    const labelDataUrl = data?.labelData?.url;
    if (!labelDataUrl) {
      return;
    }

    let canceled = false;
    void (async () => {
      try {
        const [textResponse, fileResponse] = await Promise.all([
          fetch(labelDataUrl),
          fetch(labelDataUrl),
        ]);
        if (!textResponse.ok || !fileResponse.ok || canceled) return;

        const text = await textResponse.text();
        const blob = await fileResponse.blob();
        if (canceled) return;

        const fileName = data?.labelData?.name || `update-label-${Date.now()}.csv`;
        parseAndSetCsv(text, fileName);
        setCsvFile([new File([blob], fileName, { type: blob.type || 'text/csv' })]);
      } catch {
        // ユーザーが手動でCSV再読込可能。
      }
    })();

    return () => {
      canceled = true;
    };
  }, [data]);

  useEffect(() => {
    if (!imagePreview || !data?.rects || loadedRectsRef.current) {
      return;
    }

    loadedRectsRef.current = true;
    void updateRectFromPixelTuple(imagePreview, data.rects);
  }, [imagePreview, data]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const selectedRowIndex = selectedId ? rectRowMap[selectedId] : undefined;

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">ラベル編集</Typography>
          <Typography variant="body1" color="text.secondary">
            ラベル付与の結果で修正したい内容がある場合、画面で修正を行います。<br />
            画像の空き領域をドラッグして矩形を追加できます。<br />
            矩形をクリックして移動やリサイズ・「削除」ボタンで削除が行えます。<br />
            右下の「▶」ボタンから寸法情報の一覧を開いて内容を編集できます。<br />
            準備ができたら「ラベル編集処理を開始する」ボタンを押してください。
          </Typography>

          <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 1.5, backgroundColor: '#f8fafc', display: 'grid', gap: 1.25 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>画像ファイル</Typography>
              <input type="file" accept="image/*" onChange={handleSetFile} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>CSVファイル</Typography>
              <input type="file" accept=".csv" onChange={handleSetCsvFile} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>矩形JSON(任意)</Typography>
              <input type="file" accept=".json,application/json" onChange={handleSetRectJsonFile} />
          </Paper>

          <Stack direction="row" divider={<Divider orientation="vertical" flexItem />} spacing={2} sx={{ justifyContent: 'flex-end', width: '100%'}}>
            <Button variant="contained" onClick={handleRemoveItem}>ホームに戻る</Button>
            <Button variant="contained" onClick={handleStart} disabled={imageFile.length === 0 || csvFile.length === 0}>
              ラベル編集処理を開始する
            </Button>
          </Stack>

          <Stack direction="row" sx={{ alignItems: 'center'}} spacing={1.25}>
            <Typography variant="subtitle2">編集キャンバス</Typography>
            <Button variant="contained" size="small" onClick={handleZoomOut}>-</Button>
            <Typography variant='caption'>{Math.round(zoom * 100)}%</Typography>
            <Button variant="contained" size="small" onClick={handleZoomIn}>+</Button>
            <Button variant="contained" size="small" onClick={handleDeleteSelected} disabled={!selectedId}>削除</Button>
            <Button variant="outlined" size="small" onClick={handleResetToInitialJson} disabled={!initialJsonSnapshot}>最初に戻す</Button>
          </Stack>

          {imagePreview ? (
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
                  alt="プレビュー"
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
                        {rectRowMap[rect.id] ?? index + 1}
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
          ) : (
            <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: 24, color: '#64748b', fontSize: 13 }}>
              図面を読み込むと、ここに編集キャンバスが表示されます。
            </div>
          )}

          <div style={{ fontSize: 13, color: '#475569' }}>
            {/* FIXME(keep): 操作説明は問い合わせ抑止のため残す。編集仕様が変わったら文言を更新する。 */}
            使い方: 画像の空き領域をドラッグで矩形追加。矩形クリックで選択、ドラッグで移動、四隅でリサイズ、削除ボタンで削除。
          </div>

      <Drawer
        anchor="right"
        open={showRightPanel}
        onClose={() => setShowRightPanel(false)}
        slotProps={{
          paper: {
            sx: {
              width: 700,
              maxWidth: '100vw',
              borderTopLeftRadius: 10,
              borderBottomLeftRadius: 10,
            },
          },
        }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>寸法情報リスト</Typography>
          <Button variant="contained" size="small" onClick={() => setShowRightPanel(false)}>閉じる</Button>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <TableContainer sx={{ border: 'none' }}>
            <Table sx={{ minWidth: Math.max(900, (visibleCsvColumns.length + 2) * 220), tableLayout: 'auto' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ position: 'sticky', left: 0, width: 48, backgroundColor: '#f1f5f9', zIndex: 10, fontWeight: 700 }}>No.</TableCell>
                  {visibleCsvColumns.map((column) => (
                    <TableCell key={column} sx={{ fontWeight: 700 }}>{column}</TableCell>
                  ))}
                  <TableCell sx={{ width: 90, fontWeight: 700 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {csvRows.map((row) => (
                  <TableRow
                    key={row.__rowIndex}
                    sx={{ backgroundColor: selectedRowIndex === row.__rowIndex ? '#dbeafe' : '#fff' }}
                  >
                    <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: selectedRowIndex === row.__rowIndex ? '#dbeafe' : '#fff', zIndex: 5, fontWeight: 700, textAlign: 'center' }}>
                      {row.__rowIndex}
                    </TableCell>
                    {visibleCsvColumns.map((column) => (
                      <TableCell key={`${row.__rowIndex}-${column}`}>
                        <textarea
                          value={String(row[column] ?? '')}
                          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                            const value = event.target.value;
                            setCsvRows((prev) =>
                              prev.map((currentRow) =>
                                currentRow.__rowIndex === row.__rowIndex
                                  ? { ...currentRow, [column]: value }
                                  : currentRow
                              )
                            );
                          }}
                          rows={2}
                          style={{
                            width: '100%',
                            minWidth: 180,
                            boxSizing: 'border-box',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            padding: '4px 6px',
                            fontSize: 12,
                            lineHeight: 1.35,
                            resize: 'vertical',
                          }}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button
                        type="button"
                        variant="contained"
                        size="small"
                        onClick={() => {
                          const rectId = getRectIdByRowIndex(row.__rowIndex);
                          if (rectId) {
                            handleDeleteRect(rectId);
                            return;
                          }
                          setCsvRows((prev) => prev.filter((currentRow) => currentRow.__rowIndex !== row.__rowIndex));
                        }}
                      >
                        削除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Drawer>

      {/* トグルボタン */}
      <Button
        variant="contained"
        onClick={() => setShowRightPanel(!showRightPanel)}
        sx={{
          position: 'fixed',
          bottom: 20,
          right: showRightPanel ? 580 : 20,
          zIndex: 21,
          minWidth: 0,
          transition: 'right 300ms ease-in-out',
        }}
        title={showRightPanel ? '一覧を閉じる' : '一覧を開く'}
      >
        {showRightPanel ? '◀' : '▶'}
      </Button>
        </Stack>
      </Container>
    </Box>
  );
};
