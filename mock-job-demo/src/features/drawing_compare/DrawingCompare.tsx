import React, { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { drawingCompareApi } from '../../api/drawingCompareApi.ts';
import type { Combinations } from '../../types/drawingCompare.ts';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { Header } from '../../components/Header';

export const DrawingCompare: React.FC = () => {

  const location = useLocation();
  const data = location.state;

  const navigateOptions = data?.navigateOptions ?? data ?? {};
  const [selectedInfoIndex, setSelectedInfoIndex] = useState<number>(0);

  const currentInfo = navigateOptions?.info?.[selectedInfoIndex] ?? null;

  const baseImageFile = currentInfo?.baseImageFile ?? null;
  const compareImageFile = currentInfo?.compareImageFile ?? null;

  // 座標と類似度
  const baseRects = currentInfo?.baseRects ?? {};
  const targetRects = currentInfo?.targetRects ?? {};
  const similarities = currentInfo?.similarities ?? {};

  // 図面の組み合わせ
  const [combinations, setCombinations] = useState<Combinations>({})
  // 保存済みの rects / combinations を info インデックスごとに保持
  const [savedRects, setSavedRects] = useState<Record<number, RectModel[]>>({});
  const [savedCombinations, setSavedCombinations] = useState<Record<number, Combinations>>({});

  // 図面のプレビュー
  useEffect(() => {
    const len = navigateOptions?.info?.length ?? 0;
    if (len === 0) {
      setSelectedInfoIndex(0);
      return;
    }
    if (selectedInfoIndex > len - 1) {
      setSelectedInfoIndex(0);
    }

    if (!baseImageFile || !compareImageFile) return;
    const srcUrl = URL.createObjectURL(baseImageFile);
    const tgtUrl = URL.createObjectURL(compareImageFile);
    setImages({ source: srcUrl, target: tgtUrl });

    return () => {
      URL.revokeObjectURL(srcUrl);
      URL.revokeObjectURL(tgtUrl);
    };
  }, [baseImageFile, compareImageFile]);

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

  const handlePrevInfo = () => {
    if (selectedInfoIndex <= 0) return;
    const next = selectedInfoIndex - 1;

    setSavedRects(prev => ({ ...prev, [selectedInfoIndex]: rects }));
    setSavedCombinations(prev => ({ ...prev, [selectedInfoIndex]: combinations }));

    const restoredRects = savedRects[next] ?? [];
    const restoredCombs = savedCombinations[next] ?? {};

    if (images.source) {
      try { URL.revokeObjectURL(images.source); } catch (e) {}
    }
    if (images.target) {
      try { URL.revokeObjectURL(images.target); } catch (e) {}
    }

    setSelectedInfoIndex(next);

    const nextInfo = navigateOptions?.info?.[next];
    if (nextInfo?.baseImageFile && nextInfo?.compareImageFile) {
      const srcUrl = URL.createObjectURL(nextInfo.baseImageFile);
      const tgtUrl = URL.createObjectURL(nextInfo.compareImageFile);
      setImages({ source: srcUrl, target: tgtUrl });

      try {
        if (sourceImageRef.current) sourceImageRef.current.src = srcUrl;
        if (targetImageRef.current) targetImageRef.current.src = tgtUrl;
      } catch (e) {}
    } else {
      setImages({ source: null, target: null });
    }

    setRects(restoredRects);
    initializedRef.current = restoredRects.length > 0;
    setCombinations(restoredCombs);
  }

  const handleNextInfo = () => {
    if (!navigateOptions?.info) return;
    if (selectedInfoIndex >= navigateOptions.info.length - 1) return;
    const next = selectedInfoIndex + 1;

    setSavedRects(prev => ({ ...prev, [selectedInfoIndex]: rects }));
    setSavedCombinations(prev => ({ ...prev, [selectedInfoIndex]: combinations }));

    const restoredRects = savedRects[next] ?? [];
    const restoredCombs = savedCombinations[next] ?? {};

    if (images.source) {
      try { URL.revokeObjectURL(images.source); } catch (e) {}
    }
    if (images.target) {
      try { URL.revokeObjectURL(images.target); } catch (e) {}
    }

    setSelectedInfoIndex(next);
    const nextInfo = navigateOptions?.info?.[next];
    if (nextInfo?.baseImageFile && nextInfo?.compareImageFile) {
      const srcUrl = URL.createObjectURL(nextInfo.baseImageFile);
      const tgtUrl = URL.createObjectURL(nextInfo.compareImageFile);
      setImages({ source: srcUrl, target: tgtUrl });
      try {
        if (sourceImageRef.current) sourceImageRef.current.src = srcUrl;
        if (targetImageRef.current) targetImageRef.current.src = tgtUrl;
      } catch (e) {}
    } else {
      setImages({ source: null, target: null });
    }

    setRects(restoredRects);
    initializedRef.current = restoredRects.length > 0;
    setCombinations(restoredCombs);
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

  const handleRunComparison = async () => {
    const allCombinations = { ...savedCombinations, [selectedInfoIndex]: combinations };
    setSavedCombinations(allCombinations);

    try {
      const infos = navigateOptions?.info ?? [];
      for (let i = 0; i < infos.length; i++) {
        const op = (navigateOptions.operations && navigateOptions.operations[i])
          ? navigateOptions.operations[i]
          : (navigateOptions.operations && navigateOptions.operations[0])
            ? navigateOptions.operations[0]
            : { operation: 'batch-drawing-compare', operation_id: '', status: 'start' };

        const combs = allCombinations[i] ?? {};

        const requestPayload = {
          user: navigateOptions.user,
          epic: navigateOptions.epic,
          group_id: navigateOptions.group_id,
          group_status: 'doing',
          others: navigateOptions.others,
          operations: [op],
          combinations: combs,
        };

        await drawingCompareApi.drawingCompareStart(requestPayload);
      }

      navigate("/");
    } catch (e) {
      window.alert("処理に失敗したため、画面を切り替えます");
      navigate("/");
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
          <Typography variant="h4">図面比較</Typography>
          <Typography variant="body1" color="text.secondary">
            左が基準側(客先)の図面、右が比較側(自社)の図面です。選択した矩形の組み合わせをもとに、比較結果を生成します。
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
                  比較開始
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
          title={["基準側(客先)の図面", "比較側(自社)の図面"]}
          sourcePreview={sourcePreview}
          suggestions={suggestions}
          selectedSuggestionIds={selectedSuggestionIds}
          onSelectSuggestion={handleSuggestionSelect}
        />
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 1 }}>
            <Stack direction='row' spacing={1}>
              <Button variant="outlined" onClick={handlePrevInfo} disabled={selectedInfoIndex <= 0}>
                前へ
              </Button>
              <Typography>{`${selectedInfoIndex + 1} / ${navigateOptions?.info?.length ?? 0}`}</Typography>
              <Button variant="outlined" onClick={handleNextInfo} disabled={!navigateOptions?.info || selectedInfoIndex >= (navigateOptions.info.length - 1)}>
                次へ
              </Button>
            </Stack>
          </Box>
        <Stack direction="row" spacing={2}>
          <CanvasPane
            role="source"
            title="基準側(客先)の図面"
            imageSrc={images.source}
            rects={rects}
            currentSourceId={currentSourceId}
            containerRef={sourceContainerRef}
            imageRef={sourceImageRef}
            onRectMouseDown={handleRectMouseDown('source')}
          />

          <CanvasPane
            role="target"
            title="比較側(自社)の図面"
            imageSrc={images.target}
            rects={rects}
            currentSourceId={currentSourceId}
            containerRef={targetContainerRef}
            imageRef={targetImageRef}
            onRectMouseDown={handleRectMouseDown('target')}
          />
        </Stack>
        </>
      )}
        </Stack>
      </Container>
    </Box>
  );
}

