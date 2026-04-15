export type RectRole = 'source' | 'target';
export type Phase = 'define' | 'select' | 'suggest';
export type InteractionMode = 'idle' | 'drawing' | 'moving' | 'resizing';
export type HandleDirection = 'nw' | 'ne' | 'sw' | 'se';

export interface Point {
  x: number;
  y: number;
}

export interface DraftRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RectBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageCoords?: NormalizedRect;
}

export interface SourceRect extends RectBase {
  role: 'source';
  linkedTargetIds: string[];
}

export interface TargetRect extends RectBase {
  role: 'target';
}

export type RectModel = SourceRect | TargetRect;

export interface ImageState {
  source: string | null;
  target: string | null;
}

export interface SimilarSuggestion {
  id: string;
  targetId?: string;
  label?: string;
  score: number;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  image: string;
}
