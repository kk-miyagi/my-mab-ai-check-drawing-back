import type { RectModel, SourceRect } from '../types';
import { RectFactory } from './RectFactory';

export class LinkManager {
  constructor(private readonly factory = new RectFactory()) {}

  toggle(rects: RectModel[], sourceId: string, targetId: string): RectModel[] {
    return rects.map((rect) => {
      if (rect.role !== 'source' || rect.id !== sourceId) return rect;
      const links = new Set(rect.linkedTargetIds);
      if (links.has(targetId)) {
        links.delete(targetId);
      } else {
        links.add(targetId);
      }
      return this.factory.withUpdatedLinks(rect, Array.from(links));
    });
  }

  removeTargetFromSources(rects: RectModel[], targetId: string): RectModel[] {
    return rects.map((rect) => {
      if (rect.role !== 'source') return rect;
      const filtered = rect.linkedTargetIds.filter((id) => id !== targetId);
      if (filtered.length === rect.linkedTargetIds.length) return rect;
      return this.factory.withUpdatedLinks(rect, filtered);
    });
  }

  clearSourceLinks(rects: RectModel[], sourceId: string): RectModel[] {
    return rects.map((rect) => {
      if (rect.role !== 'source' || rect.id !== sourceId) return rect;
      return this.factory.withUpdatedLinks(rect as SourceRect, []);
    });
  }
}
