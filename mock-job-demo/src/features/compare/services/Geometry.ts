import type { Point } from '../types';

export class Geometry {
  toPercent(
    container: HTMLDivElement | HTMLImageElement | null,
    clientX: number,
    clientY: number
  ): Point {
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: this.clamp(x, 0, 100),
      y: this.clamp(y, 0, 100),
    };
  }

  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
