import type { DraftRect, HandleDirection, Point, RectModel } from '../types';
import { Geometry } from './Geometry';

export class RectManipulator {
  constructor(private readonly geometry = new Geometry()) {}

  buildDraft(start: Point, current: Point): DraftRect {
    // ドラッグ開始/終了座標（%）からドラフト矩形を作成。
    const x = Math.min(current.x, start.x);
    const y = Math.min(current.y, start.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    return { x, y, width, height };
  }

  shouldPersist(draft: DraftRect | null): draft is DraftRect {
    if (!draft) return false;
    return draft.width > 1 || draft.height > 1;
  }

  move(
    rects: RectModel[],
    rectId: string | null,
    initialRect: RectModel | null,
    start: Point,
    current: Point
  ): RectModel[] {
    if (!rectId || !initialRect) return rects;

    const deltaX = current.x - start.x;
    const deltaY = current.y - start.y;

    // 画像領域外に出ないよう移動量をクランプ。
    const newX = this.geometry.clamp(initialRect.x + deltaX, 0, 100 - initialRect.width);
    const newY = this.geometry.clamp(initialRect.y + deltaY, 0, 100 - initialRect.height);

    if (newX === initialRect.x && newY === initialRect.y) return rects;

    return rects.map((rect) =>
      rect.id === rectId
        ? { ...rect, x: newX, y: newY }
        : rect
    );
  }

  resize(
    rects: RectModel[],
    rectId: string | null,
    initialRect: RectModel | null,
    handle: HandleDirection | null,
    start: Point,
    current: Point
  ): RectModel[] {
    if (!rectId || !initialRect || !handle) return rects;

    let { x, y, width, height } = initialRect;
    const deltaX = current.x - start.x;
    const deltaY = current.y - start.y;

    if (handle.includes('e')) width += deltaX;
    if (handle.includes('w')) {
      x += deltaX;
      width -= deltaX;
    }
    if (handle.includes('s')) height += deltaY;
    if (handle.includes('n')) {
      y += deltaY;
      height -= deltaY;
    }

    width = Math.max(2, width);
    height = Math.max(2, height);

    // リサイズ後も 0-100% のビューポート内に収める。
    x = this.geometry.clamp(x, 0, 100);
    y = this.geometry.clamp(y, 0, 100);
    width = Math.min(width, 100 - x);
    height = Math.min(height, 100 - y);

    return rects.map((rect) =>
      rect.id === rectId
        ? { ...rect, x, y, width, height }
        : rect
    );
  }
}
