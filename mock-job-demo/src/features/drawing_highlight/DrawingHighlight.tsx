import React, { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'
import type {
  ImageState,
  Phase,
  RectModel,
  RectRole,
  SimilarSuggestion,
} from './types.ts';
import { LinkManager } from './services/LinkManager';
import { Cropper } from './services/Cropper';
import { ChageRect } from './services/ChageRect';
import { CanvasPane } from './components/CanvasPane';
import { SuggestionScreen } from './components/SuggestionScreen';
import { localStorageKey } from '../../constants/localStorageKey.ts';
import { LocalStorageData } from '../../types/storage.ts';
import { drawingHighlightApi } from '../../api/drawingHighlightApi.ts';
import type { Combinations } from '../../types/drawingCompare.ts';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { Header } from '../../components/Header';

export const DrawingHighlight: React.FC = () => {

  // アップロードした図面
  const location = useLocation();
  const data = location.state;
  const baseImageFile = data.baseImageFile;
  const compareImageFile = data.compareImageFile;

  // 座標と類似度
  const baseRects = data.baseRects;
  const targetRects = data.targetRects;
  const similarities = data.similarities;

  // 図面の組み合わせ
  const [combinations, setCombinations] = useState<Combinations>({})

  // 図面のプレビュー
  useEffect(() => {
    setImages({ source: URL.createObjectURL(baseImageFile[0]), target: URL.createObjectURL(compareImageFile[0]) })
  }, [])

  // サービスは ref に保持して再レンダーでも同じインスタンスを使う。
  const linkManagerRef = useRef(new LinkManager());
  const cropperRef = useRef(new Cropper());

  // 3フェーズ（define → select → suggest）を駆動する全体状態。
  const [phase, setPhase] = useState<Phase>('define');
  const [images, setImages] = useState<ImageState>({ source: null, target: null });
  const [rects, setRects] = useState<RectModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentSourceId, setCurrentSourceId] = useState<string | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SimilarSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);

  const sourceContainerRef = useRef<HTMLDivElement>(null);
  const targetContainerRef = useRef<HTMLDivElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const targetImageRef = useRef<HTMLImageElement>(null);

  const handleRectMouseDown = (role: RectRole) => (
    event: React.MouseEvent<HTMLDivElement>,
    id: string
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    if (phase === 'select') {
      handleSelectPhaseClick(role, id);
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
  }, [images])

  const handlSetPahseSuggest = () => {
    setPhase('suggest');
  }

  const handleSelectPhaseClick = (role: RectRole, id: string) => {
    if (role === 'source') {
      // Source を選ぶと候補確認フェーズへ遷移。
      setCurrentSourceId(id);
      setSelectedSuggestionIds([]);
      return;
    }

    if (!currentSourceId) {
      alert('先に左側の比較元 (Source) をクリックして選択してください');
      return;
    }
    setRects((prev) => linkManagerRef.current.toggle(prev, currentSourceId, id));
  };

  const handleProceed = () => {
    // 紐付けフェーズへ進み、最初の Source を自動選択。
    setPhase('select');
    const firstSource = rects.find((rect) => rect.role === 'source');
    setCurrentSourceId(firstSource?.id ?? null);
    setSelectedId(null);
    setSelectedSuggestionIds([]);
  };


  const navigate = useNavigate();

  const handleRunComparison = () => {
    const sourceRect = rects.filter((rect) => rect.role === 'source');
    const result = sourceRect.map(({ id, linkedTargetIds }) => ({ id, linkedTargetIds }));
    navigate("/")

    // ローカルストレージの取得
    const getLocalStorage = window.localStorage.getItem(localStorageKey.drawingHighlight)
    if (!getLocalStorage) {
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/")
      return
    }

    // ローカルストレージの値を変更
    const localStorageData: LocalStorageData  = JSON.parse(getLocalStorage);
    localStorageData.operation = 'drawing-highlight'
    localStorageData.status = 'start'
    window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));

    if (!localStorageData.operationId) {
      return
    }

    try {
      localStorageData.status = "doing"
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
      const requestPayload  = {
        user: localStorageData.user,
        epic: localStorageData.epic,
        operation: localStorageData.operation,
        operation_id: localStorageData.operationId,
        status: localStorageData.status,
        combinations: combinations
      };
      const res = drawingHighlightApi.DrawingHighligh(requestPayload)
      localStorageData.status = 'end'
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
      navigate("/")
    } catch (e) {
      localStorageData.status = 'error'
      window.localStorage.setItem(localStorageKey.drawingHighlight, JSON.stringify(localStorageData));
      window.alert("処理に失敗したため、画面を切り替えます")
      navigate("/")
    }
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
      const candidates = targets.slice(0, targets.length);

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
          label: labelIndex >= 0 ? `Target #${rect.id}` : undefined,
          score,
          rect: { x: cropRect.x, y: cropRect.y, width: cropRect.width, height: cropRect.height },
          image,
        });
      }
      result.sort((a, b) => a.score - b.score);

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

  const canCompare = rects.some(
    (rect) => rect.role === 'source' && rect.linkedTargetIds.length > 0
  );
  const sourceIndex = rects.filter((r) => r.role === 'source').findIndex((r) => r.id === currentSourceId);
  const currentSourceLabel = sourceIndex >= 0 ? `Source #${sourceIndex + 1}` : undefined;

  useEffect(() => {
    setCombinations({})
    const t = rects.filter((r) => r.role === 'source' && r.linkedTargetIds.length > 0)
    Object.entries(t).forEach(([key, values]) => {
      setCombinations(prev => ({...prev, [values.id]: values.linkedTargetIds}))
    })
  }, [rects]);


  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">差分ハイライト</Typography>
          <Typography variant="body1" color="text.secondary">
            左が修正前の図面、右が修正後の図面です。選択した矩形の組み合わせをもとに、差分をハイライトした図面を生成します。
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Stack direction='row' spacing={2}>
              {phase === 'define' ? (
                <>
                <Button
                  variant="contained"
                  onClick={handleProceed}
                >
                  紐づけ設定
                </Button>
                </>
              ) : phase === 'select' ? (
                <>
                <Button
                  variant="contained"
                  onClick={handlSetPahseSuggest}
                >
                  詳細から選択
                </Button>
                <Button
                  variant="contained"
                  onClick={handleRunComparison}
                  disabled={!canCompare}
                >
                  ハイライト開始
                </Button>
                </>
              ) : (
                <>
                <Button
                  variant="contained"
                  onClick={handleSuggestionCancel}
                >
                  戻る
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSuggestionConfirm}
                  disabled={loadingSuggestions || (suggestions.some((s) => s.targetId) && selectedSuggestionIds.length === 0)}
                >
                  保存して戻る
                </Button>
                
                </>
              )}
            </Stack>
          </Box>
      {phase === 'suggest' ? (
        <SuggestionScreen
          title={["修正前の図面", "修正後の図面"]}
          sourcePreview={sourcePreview}
          suggestions={suggestions}
          selectedSuggestionIds={selectedSuggestionIds}
          onSelectSuggestion={handleSuggestionSelect}
        />
      ) : (
        <Stack direction="row" spacing={2}>
          <CanvasPane
            role="source"
            title="修正前の図面"
            imageSrc={images.source}
            rects={rects}
            currentSourceId={currentSourceId}
            containerRef={sourceContainerRef}
            imageRef={sourceImageRef}
            onRectMouseDown={handleRectMouseDown('source')}
          />

          <CanvasPane
            role="target"
            title="修正後の図面"
            imageSrc={images.target}
            rects={rects}
            currentSourceId={currentSourceId}
            containerRef={targetContainerRef}
            imageRef={targetImageRef}
            onRectMouseDown={handleRectMouseDown('target')}
          />
        </Stack>
      )}
        </Stack>
      </Container>
    </Box>
  );
}

