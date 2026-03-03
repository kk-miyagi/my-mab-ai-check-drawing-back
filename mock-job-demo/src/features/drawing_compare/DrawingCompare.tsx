import React, { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'
import { Link2, MousePointer2 } from 'lucide-react';
import './styles.css';
import type {
  DraftRect,
  HandleDirection,
  ImageState,
  InteractionMode,
  Phase,
  Point,
  RectModel,
  RectRole,
  SimilarSuggestion,
} from './types.ts';
import { Geometry } from './services/Geometry';
import { RectFactory } from './services/RectFactory';
import { RectManipulator } from './services/RectManipulator';
import { LinkManager } from './services/LinkManager';
import { Cropper } from './services/Cropper';
import { ChageRect } from './services/ChageRect';
// モック用の疑似的に類似度を出すコード実際は API 経由でサーバー側処理を呼び出す。
import { fetchSuggestions } from './services/SuggestionApi';
import { CanvasPane } from './components/CanvasPane';
import { Sidebar } from './components/Sidebar';
import { HeaderSection } from './components/HeaderSection';
import { ResultModal } from './components/ResultModal';
import { SuggestionScreen } from './components/SuggestionScreen';
import { localStorageKey } from '../../constants/localStorageKey.ts';

const SAMPLE_IMAGES = {
  source: 'https://placehold.co/800x600/f1f5f9/94a3b8?text=Source+Drawing+A',
  target: 'https://placehold.co/800x600/e2e8f0/64748b?text=Target+Drawing+B',
};

export const DrawingCompare: React.FC = () => {

  // アップロードした図面
  const location = useLocation();
  const data = location.state;
  const baseImageFile = data.baseImageFile;
  const compareImageFile = data.compareImageFile;

  // 座標と類似度
  const baseRects = data.baseRects;
  const targetRects = data.targetRects;
  const similarities = data.similarities;

  // console.log(baseRects)
  // Object.keys(baseRects).forEach((i) =>{
  //   console.log(i.)
  // })

  // 図面のプレビュー
  useEffect(() => {
    setImages({ source: URL.createObjectURL(baseImageFile[0]), target: URL.createObjectURL(compareImageFile[0]) })
  }, [])

  // サービスは ref に保持して再レンダーでも同じインスタンスを使う。
  const geometryRef = useRef(new Geometry());
  const factoryRef = useRef(new RectFactory());
  const manipulatorRef = useRef(new RectManipulator(geometryRef.current));
  const linkManagerRef = useRef(new LinkManager());
  const cropperRef = useRef(new Cropper());

  // 3フェーズ（define → select → suggest）を駆動する全体状態。
  const [phase, setPhase] = useState<Phase>('define');
  const [images, setImages] = useState<ImageState>({ source: null, target: null });
  const [rects, setRects] = useState<RectModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentSourceId, setCurrentSourceId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('idle');
  const [activeCanvas, setActiveCanvas] = useState<RectRole | null>(null);
  const [activeHandle, setActiveHandle] = useState<HandleDirection | null>(null);
  const [startPos, setStartPos] = useState<Point>({ x: 0, y: 0 });
  const [startPosImage, setStartPosImage] = useState<Point>({ x: 0, y: 0 });
  const [initialRectState, setInitialRectState] = useState<RectModel | null>(null);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [draftImageRect, setDraftImageRect] = useState<DraftRect | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SimilarSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);

  const sourceContainerRef = useRef<HTMLDivElement>(null);
  const targetContainerRef = useRef<HTMLDivElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const targetImageRef = useRef<HTMLImageElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const getContainer = (role: RectRole) => (role === 'source' ? sourceContainerRef.current : targetContainerRef.current);
  const getImageElement = (role: RectRole) => (role === 'source' ? sourceImageRef.current : targetImageRef.current);

  const getRelativePos = (role: RectRole, event: React.MouseEvent) =>
    geometryRef.current.toPercent(getContainer(role), event.clientX, event.clientY);

  // 画像実寸（表示サイズ）基準の%座標を取得しておき、クロップ用の座標ずれを防ぐ。
  const getRelativePosOnImage = (role: RectRole, event: React.MouseEvent) =>
    geometryRef.current.toPercent(getImageElement(role), event.clientX, event.clientY);

  const handleUpload = (role: RectRole, event: React.ChangeEvent<HTMLInputElement>) => {
    // ファイルを data URL で読み込み、該当キャンバスの矩形をリセット。
    const file = event.target.files?.[0];
    const input = event.target;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') return;

      setImages((prev) => ({ ...prev, [role]: result }));
      setRects((prev) => prev.filter((rect) => rect.role !== role));
      console.log(1)
      setSelectedId(null);
      setCurrentSourceId(null);
      setSourcePreview(null);
      setSuggestions([]);
      setLoadingSuggestions(false);
      input.value = '';
    };
    reader.readAsDataURL(file);
  };

  // const handleSelectSample = (role: RectRole) => {
  //   // サンプル画像をセットし、その側の矩形をクリア。
  //   const sample = role === 'source' ? SAMPLE_IMAGES.source : SAMPLE_IMAGES.target;
  //   setImages((prev) => ({ ...prev, [role]: sample }));
  //   setRects((prev) => prev.filter((rect) => rect.role !== role));
  //   setSelectedId(null);
  //   setCurrentSourceId(null);
  //   setSourcePreview(null);
  //   setSuggestions([]);
  //   setLoadingSuggestions(false);
  //   setSelectedSuggestionIds([]);
  // };

  const handleBackgroundMouseDown = (role: RectRole) => (event: React.MouseEvent<HTMLDivElement>) => {
    if (phase !== 'define' || event.button !== 0) return;
    if (!images[role]) return;

    // クリック地点から矩形ドラフトを開始。
    const pos = getRelativePos(role, event);
    const posImage = getRelativePosOnImage(role, event);
    console.log(pos, posImage)
    console.log("ここでdrawingになる")
    setSelectedId(null);
    setActiveCanvas(role);
    setInteractionMode('drawing');
    setStartPos(pos);
    setStartPosImage(posImage);
    setDraftRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    setDraftImageRect({ x: posImage.x, y: posImage.y, width: 0, height: 0 });
  };

  const handleRectMouseDown = (role: RectRole) => (
    event: React.MouseEvent<HTMLDivElement>,
    id: string
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    // if (phase === 'define') {
    //   // define フェーズでは矩形クリックで移動開始。
    //   setSelectedId(id);
    //   setActiveCanvas(role);
    //   setInteractionMode('moving');

    //   const pos = getRelativePos(role, event);
    //   const posImage = getRelativePosOnImage(role, event);
    //   setStartPos(pos);
    //   setStartPosImage(posImage);
    //   const targetRect = rects.find((rect) => rect.id === id) || null;
    //   setInitialRectState(targetRect);
    //   return;
    // }

    if (phase === 'select') {
      handleSelectPhaseClick(role, id);
    }
  };

  const handleHandleMouseDown = (role: RectRole) => (
    event: React.MouseEvent<HTMLDivElement>,
    id: string,
    handle: HandleDirection
  ) => {
    if (event.button !== 0 || phase !== 'define') return;
    event.stopPropagation();
    event.preventDefault();

    // ハンドルを掴んだ場合はリサイズ開始。
    setActiveCanvas(role);
    setInteractionMode('resizing');
    setActiveHandle(handle);

    const pos = getRelativePos(role, event);
    const posImage = getRelativePosOnImage(role, event);
    setStartPos(pos);
    setStartPosImage(posImage);
    const targetRect = rects.find((rect) => rect.id === id) || null;
    setInitialRectState(targetRect);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (phase !== 'define' || interactionMode === 'idle' || !activeCanvas) return;

    const currentPos = geometryRef.current.toPercent(getContainer(activeCanvas), event.clientX, event.clientY);
    const currentPosImage = geometryRef.current.toPercent(getImageElement(activeCanvas), event.clientX, event.clientY);

    if (interactionMode === 'drawing') {
      // カーソルに合わせてドラフト矩形を更新。
      setDraftRect(manipulatorRef.current.buildDraft(startPos, currentPos));
      setDraftImageRect(manipulatorRef.current.buildDraft(startPosImage, currentPosImage));
      return;
    }

    if (interactionMode === 'moving' && initialRectState) {
      // 画像範囲内で移動を反映（オーバーレイ座標と画像座標の両方を更新）。
      const overlayMoved = manipulatorRef.current.move(
        [initialRectState],
        selectedId,
        initialRectState,
        startPos,
        currentPos
      )[0];

      const initialImageRect = initialRectState.imageCoords
        ? { ...initialRectState, ...initialRectState.imageCoords }
        : { ...initialRectState };

      const imageMoved = manipulatorRef.current.move(
        [initialImageRect],
        selectedId,
        initialImageRect,
        startPosImage,
        currentPosImage
      )[0];
      console.log(2)
      setRects((prev) =>
        prev.map((rect) =>
          rect.id === selectedId
            ? {
                ...rect,
                x: overlayMoved.x,
                y: overlayMoved.y,
                width: overlayMoved.width,
                height: overlayMoved.height,
                imageCoords: {
                  x: imageMoved.x,
                  y: imageMoved.y,
                  width: imageMoved.width,
                  height: imageMoved.height,
                },
              }
            : rect
        )
      );
      return;
    }

    if (interactionMode === 'resizing' && initialRectState && activeHandle) {
      // ハンドル方向にリサイズし、両座標系でクランプ。
      const overlayResized = manipulatorRef.current.resize(
        [initialRectState],
        selectedId,
        initialRectState,
        activeHandle,
        startPos,
        currentPos
      )[0];

      const initialImageRect = initialRectState.imageCoords
        ? { ...initialRectState, ...initialRectState.imageCoords }
        : { ...initialRectState };

      const imageResized = manipulatorRef.current.resize(
        [initialImageRect],
        selectedId,
        initialImageRect,
        activeHandle,
        startPosImage,
        currentPosImage
      )[0];
      console.log(3)
      setRects((prev) =>
        prev.map((rect) =>
          rect.id === selectedId
            ? {
                ...rect,
                x: overlayResized.x,
                y: overlayResized.y,
                width: overlayResized.width,
                height: overlayResized.height,
                imageCoords: {
                  x: imageResized.x,
                  y: imageResized.y,
                  width: imageResized.width,
                  height: imageResized.height,
                },
              }
            : rect
        )
      );
    }
  };

  const handleSetRect = () => {
    setRects([])
    const changeRect = new ChageRect()

    Object.entries(baseRects).forEach(([key, values]) => {
      (async () => {
        const res = await changeRect.crop(images.source, {x: values[0], y: values[1], width: values[2], height: values[3]})
        setRects(prev => [
          ...prev,
          {
            id: key,
            role: 'source',
            x: res.x,
            y: res.y,
            width: res.width,
            height: res.height,
            imageCoords: {x: values[0], y: values[1], width: values[2], height: values[3]},
            linkedTargetIds: []
          }
        ])
      })()
    })
    Object.entries(targetRects).forEach(([key, values]) => {
      (async () => {
        const res = await changeRect.crop(images.target, {x: values[0], y: values[1], width: values[2], height: values[3]})
        setRects(prev => [
          ...prev,
          {
            id: key,
            role: 'target',
            x: res.x,
            y: res.y,
            width: res.width,
            height: res.height,
            imageCoords: {x: values[0], y: values[1], width: values[2], height: values[3]}
          }
        ])
      })()
    })
  } 
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (!images.source || !images.target) return;
    initializedRef.current = true;
    handleSetRect();
    console.log(images.source, images.target, initializedRef.current)
  }, [images])

  // 矩形領域を最初に作成すると動くようだ
  const handleMouseUp = () => {
    if (phase === 'define' && interactionMode === 'drawing' && activeCanvas) {
      if (manipulatorRef.current.shouldPersist(draftRect)) {
        // 最低サイズを満たしたドラフト矩形を確定。
        const nextRect = factoryRef.current.create(
          activeCanvas,
          draftRect as DraftRect,
          (draftImageRect as DraftRect) ?? (draftRect as DraftRect)
        );
        console.log(4, nextRect)
        setRects((prev) => [...prev, nextRect]);
        setSelectedId(nextRect.id);
      }
    }

    setInteractionMode('idle');
    setDraftRect(null);
    setDraftImageRect(null);
    setInitialRectState(null);
    setActiveHandle(null);
    setActiveCanvas(null);
  };

  const handleSelectPhaseClick = (role: RectRole, id: string) => {
    if (role === 'source') {
      // Source を選ぶと候補確認フェーズへ遷移。
      setCurrentSourceId(id);
      setSelectedSuggestionIds([]);
      setPhase('suggest');
      return;
    }

    if (!currentSourceId) {
      alert('先に左側の比較元 (Source) をクリックして選択してください');
      return;
    }
    console.log(5)
    setRects((prev) => linkManagerRef.current.toggle(prev, currentSourceId, id));
  };

  const handleDelete = (id: string) => {
    // 矩形を削除し、紐付けの残骸を掃除。
    setRects((prev) => {
      const removed = prev.filter((rect) => rect.id !== id);
      const cleaned = linkManagerRef.current.removeTargetFromSources(removed, id);
      return cleaned;
    });
    if (selectedId === id) setSelectedId(null);
    if (currentSourceId === id) {
      setCurrentSourceId(null);
      setSourcePreview(null);
      setSuggestions([]);
      setLoadingSuggestions(false);
      setSelectedSuggestionIds([]);
    }
  };

  const handleClearAll = () => {
    // 全状態を初期化。
    setRects([]);
    setSelectedId(null);
    setCurrentSourceId(null);
    setDraftRect(null);
    setImages({ source: null, target: null });
    setSourcePreview(null);
    setSuggestions([]);
    setLoadingSuggestions(false);
    setSelectedSuggestionIds([]);
  };

  const handleProceed = () => {
    // 紐付けフェーズへ進み、最初の Source を自動選択。
    setPhase('select');
    const firstSource = rects.find((rect) => rect.role === 'source');
    setCurrentSourceId(firstSource?.id ?? null);
    setSelectedId(null);
    setSelectedSuggestionIds([]);
  };

  const handleSelectSourceFromSidebar = (id: string) => {
    setCurrentSourceId(id);
    setSelectedSuggestionIds([]);
    setPhase('suggest');
  };

  const handleBackToDefine = () => {
    // 矩形を保持したまま define フェーズに戻る。
    setPhase('define');
    setInteractionMode('idle');
    setDraftRect(null);
    setSourcePreview(null);
    setSuggestions([]);
    setLoadingSuggestions(false);
    setSelectedSuggestionIds([]);
  };

  const navigate = useNavigate();

  // const handleRunComparison = () => setShowResult(true);
  const handleRunComparison = () => {
    const sourceRect = rects.filter((rect) => rect.role === 'source');
    const result = sourceRect.map(({ id, linkedTargetIds }) => ({ id, linkedTargetIds }));
    console.log(result)
    // navigate("/drawing-compare-processing")
    // const toPersist =JSON.parse(window.localStorage.getItem(localStorageKey.drawingCompare) as string);
    // toPersist.lastOperation = "batch-drawing-compare"
    // window.localStorage.setItem(localStorageKey.drawingCompare, JSON.stringify(toPersist));
    // const requestPayload  = {
    //   user: 'demo-user',
    //   epic: toPersist.lastEpic,
    //   operation: toPersist.lastOperation ,
    //   operation_id: toPersist.operationId,
    //   status: toPersist.status,
      
    // };
    // drawingReviewApi.drawingReviewStart()
  };

  const buildSourcePreviewAndSuggestions = async (sourceId: string | null, targetRects: RectModel[] = rects) => {
    if (!sourceId) {
      setSourcePreview(null);
      setSuggestions([]);
      return;
    }

    // 選択した Source をクロップし、擬似スコアの候補を生成。
    const sourceRect = rects.find((rect) => rect.id === sourceId && rect.role === 'source');
    if (!sourceRect || !images.source) {
      setSourcePreview(null);
      setSuggestions([]);
      return;
    }

    try {
      setLoadingSuggestions(true);
      // なぜかここ修正が必要だった。
      // const cropRect = sourceRect.imageCoords ?? sourceRect;
      const cropRect = {x: sourceRect.x, y: sourceRect.y, width: sourceRect.width, height: sourceRect.height};
      const preview = await cropperRef.current.crop(images.source, cropRect);
      setSourcePreview(preview);

      if (!images.target) {
        setSuggestions([]);
        return;
      }

      const t = Object.entries(similarities).filter(([key]) => key === sourceId)[0][1]
      const allowedIds = new Set(Object.keys(t));

      const targets = targetRects.filter((r) => r.role === 'target' && allowedIds.has(r.id));
      console.log(targets)
      const candidates = targets.slice(0, 3);

      const result: SimilarSuggestion[] = [];

      for (const rect of candidates) {
        const labelIndex = targets.findIndex((t) => t.id === rect.id);
        const score = similarities[sourceId][rect.id]

        // const cropRect = rect.imageCoords ?? rect;
        // なぜかここ修正が必要だった。
        const cropRect = {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
        const image = await cropperRef.current.crop(images.target, cropRect);
        result.push({
          id: `t-${rect.id}`,
          targetId: rect.id,
          label: labelIndex >= 0 ? `Target #${labelIndex + 1}` : undefined,
          score,
          rect: { x: cropRect.x, y: cropRect.y, width: cropRect.width, height: cropRect.height },
          image,
        });
      }

      setSuggestions(result);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (phase !== 'select' && phase !== 'suggest') {
      setSourcePreview(null);
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    void buildSourcePreviewAndSuggestions(currentSourceId, rects);
  }, [phase, currentSourceId, images.source, images.target, rects]);

  const handleSuggestionSelect = (id: string) => {
    setSelectedSuggestionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSuggestionConfirm = () => {
    if (selectedSuggestionIds.length > 0 && currentSourceId) {
      const chosenTargets = suggestions
        .filter((s) => selectedSuggestionIds.includes(s.id) && s.targetId)
        .map((s) => s.targetId as string);

      if (chosenTargets.length > 0) {
        setRects((prev) =>
          prev.map((rect) => {
            if (rect.role === 'source' && rect.id === currentSourceId) {
              const merged = Array.from(new Set([...(rect.linkedTargetIds ?? []), ...chosenTargets]));
              return { ...rect, linkedTargetIds: merged };
            }
            return rect;
          })
        );
      }
    }

    setPhase('select');
    setSelectedSuggestionIds([]);
  };

  const handleSuggestionCancel = () => {
    setPhase('select');
    setSelectedSuggestionIds([]);
  };

  const hasSources = rects.some((rect) => rect.role === 'source');
  const hasTargets = rects.some((rect) => rect.role === 'target');
  // const canProceed = hasSources && hasTargets && !!images.source && !!images.target;
  const canProceed = true;
  const canCompare = rects.some(
    (rect) => rect.role === 'source' && rect.linkedTargetIds.length > 0
  );
  const sourceIndex = rects.filter((r) => r.role === 'source').findIndex((r) => r.id === currentSourceId);
  const currentSourceLabel = sourceIndex >= 0 ? `Source #${sourceIndex + 1}` : undefined;

  const instructionSource =
    phase === 'select' ? (
      <div className="instruction-bar">
        <MousePointer2 size={14} />
        まずここから基準となる矩形を選択してください（青くなります）
      </div>
    ) : undefined;

  const instructionTarget =
    phase === 'select' ? (
      <div
        className="instruction-bar"
        style={{ backgroundColor: '#fff1f2', color: '#be123c', borderColor: '#fda4af' }}
      >
        <Link2 size={14} /> 左で選択したSourceに紐付ける矩形をクリック（赤くなります）
      </div>
    ) : undefined;


  return (
    <div
      className="app-container"
      // onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <HeaderSection
        phase={phase}
        hasRects={rects.length > 0}
        canProceed={canProceed}
        canCompare={canCompare}
        onClearAll={handleClearAll}
        onGoNext={handleProceed}
        onBackToDefine={handleBackToDefine}
        onBackToSelect={handleSuggestionCancel}
        onRunComparison={handleRunComparison}
      />

      {phase === 'suggest' ? (
        <SuggestionScreen
          sourcePreview={sourcePreview}
          suggestions={suggestions}
          loading={loadingSuggestions}
          currentSourceLabel={currentSourceLabel}
          selectedSuggestionIds={selectedSuggestionIds}
          onSelectSuggestion={handleSuggestionSelect}
          onBack={handleSuggestionCancel}
          onConfirm={handleSuggestionConfirm}
        />
      ) : (
        <div className="main-area">
          <CanvasPane
            role="source"
            phase={phase}
            title="比較元図面 (Source)"
            instruction={instructionSource}
            imageSrc={images.source}
            rects={rects}
            draftRect={draftRect}
            selectedId={selectedId}
            currentSourceId={currentSourceId}
            containerRef={sourceContainerRef}
            imageRef={sourceImageRef}
            isDrafting={interactionMode === 'drawing' && activeCanvas === 'source'}
            // onBackgroundMouseDown={handleBackgroundMouseDown('source')}
            onRectMouseDown={handleRectMouseDown('source')}
            onHandleMouseDown={handleHandleMouseDown('source')}
            onRequestUpload={() => sourceInputRef.current?.click()}
            onSelectSample={() => handleSelectSample('source')}
          />

          <CanvasPane
            role="target"
            phase={phase}
            title="比較先図面 (Target)"
            instruction={instructionTarget}
            imageSrc={images.target}
            rects={rects}
            draftRect={draftRect}
            selectedId={selectedId}
            currentSourceId={currentSourceId}
            containerRef={targetContainerRef}
            imageRef={targetImageRef}
            isDrafting={interactionMode === 'drawing' && activeCanvas === 'target'}
            // onBackgroundMouseDown={handleBackgroundMouseDown('target')}
            onRectMouseDown={handleRectMouseDown('target')}
            onHandleMouseDown={handleHandleMouseDown('target')}
            onRequestUpload={() => targetInputRef.current?.click()}
            onSelectSample={() => handleSelectSample('target')}
          />

          {/* <Sidebar
            phase={phase}
            rects={rects}
            selectedId={selectedId}
            currentSourceId={currentSourceId}
            onSelectRect={setSelectedId}
            onSelectSourceForLink={handleSelectSourceFromSidebar}
            onToggleTargetLink={(id) => handleSelectPhaseClick('target', id)}
            onDelete={handleDelete}
          /> */}
        </div>
      )}

      <ResultModal
        open={showResult}
        rects={rects}
        sourceImg={images.source}
        targetImg={images.target}
        onClose={() => setShowResult(false)}
      />

      {/* <p>{rects.length}</p>
      <p>phase: {phase}</p>
      <p>{interactionMode}</p>
      {phase === 'define' && interactionMode === 'idle' && (
      <button onClick={handleSetRect}>現状ここで矩形を画面に出す。最終的には画面が切り替わったタイミングで矩形を出せるようにする</button>
      )} */}

    </div>
  );
}

