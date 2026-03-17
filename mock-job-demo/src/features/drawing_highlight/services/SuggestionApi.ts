import type { RectModel, SimilarSuggestion } from '../types.ts';
import { Cropper } from './Cropper';

interface FetchSuggestionsParams {
  sourceRect: RectModel;
  targetImg: string;
  targetRects: RectModel[];
  cropper: Cropper;
}

const API_LATENCY_MS = 0;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 擬似APIとして類似候補を返すモック。
 * - 既存の Target 矩形を優先し、足りない分はランダム矩形で補完。
 * - スコアは疑似的に計算し、降順で返す。
 */
export async function fetchSuggestions({ sourceRect, targetImg, targetRects, cropper }: FetchSuggestionsParams): Promise<SimilarSuggestion[]> {
  // ネットワーク風の待ち時間を挟んで API 呼び出し感を出す。
  await delay(API_LATENCY_MS);

  const result: SimilarSuggestion[] = [];
  const targets = targetRects.filter((r) => r.role === 'target');
  const candidates = targets.slice(0, 3);

  // 既存 Target 矩形にスコアを付与してクロップ。
  for (const rect of candidates) {
    const labelIndex = targets.findIndex((t) => t.id === rect.id);
    const score = 82 + Math.random() * 15; // 82-97%
    // const cropRect = rect.imageCoords ?? rect;
    // なぜかここ修正が必要だった。
    const cropRect = {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
    const image = await cropper.crop(targetImg, cropRect);
    result.push({
      id: `t-${rect.id}`,
      targetId: rect.id,
      label: labelIndex >= 0 ? `Target #${labelIndex + 1}` : undefined,
      score,
      rect: { x: cropRect.x, y: cropRect.y, width: cropRect.width, height: cropRect.height },
      image,
    });
  }

  // 足りない場合は Source 付近にランダム矩形を生成して補完。
  let i = 0;
  while (result.length < 3) {
    const sizeFactor = 0.8 + Math.random() * 0.5; // 0.8x - 1.3x of source size
    const width = Math.min(100, Math.max(5, sourceRect.width * sizeFactor));
    const height = Math.min(100, Math.max(5, sourceRect.height * sizeFactor));
    const x = Math.max(0, Math.min(100 - width, sourceRect.x + (Math.random() * 20 - 10)));
    const y = Math.max(0, Math.min(100 - height, sourceRect.y + (Math.random() * 20 - 10)));

    const score = 78 + Math.random() * 10; // 78-88%
    const image = await cropper.crop(targetImg, { x, y, width, height });
    result.push({
      id: `s-${i}`,
      label: `Auto #${i + 1}`,
      score,
      rect: { x, y, width, height },
      image,
    });
    i += 1;
  }

  return result.sort((a, b) => b.score - a.score);
}
