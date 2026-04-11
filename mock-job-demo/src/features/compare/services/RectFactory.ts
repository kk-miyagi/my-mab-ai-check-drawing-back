import type { DraftRect, NormalizedRect, RectModel, RectRole, SourceRect, TargetRect } from '../types';

export class RectFactory {
  create(role: RectRole, rect: DraftRect, imageRect?: NormalizedRect): RectModel {
    // ドラフト矩形に ID を付与して型付きモデルへ整形（オーバーレイ座標と画像座標を保持）。
    const id = this.createId();
    const base = { id, ...rect, imageCoords: imageRect ?? rect };
    return role === 'source'
      ? { ...base, role, linkedTargetIds: [] } satisfies SourceRect
      : { ...base, role } satisfies TargetRect;
  }

  withUpdatedLinks(rect: SourceRect, linkedTargetIds: string[]): SourceRect {
    return { ...rect, linkedTargetIds: [...linkedTargetIds] };
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return Date.now().toString();
  }
}
