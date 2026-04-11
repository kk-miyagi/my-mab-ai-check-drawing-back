import React from 'react';
import { Link2 } from 'lucide-react';
import type {
  DraftRect,
  HandleDirection,
  Phase,
  RectModel,
  RectRole,
} from '../types';

interface CanvasPaneProps {
  role: RectRole;
  phase: Phase;
  title: string;
  instruction?: React.ReactNode;
  imageSrc: string | null;
  rects: RectModel[];
  draftRect: DraftRect | null;
  selectedId: string | null;
  currentSourceId: string | null;
  containerRef: React.RefObject<HTMLDivElement>;
  imageRef: React.RefObject<HTMLImageElement>;
  isDrafting: boolean;
  onBackgroundMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onRectMouseDown: (event: React.MouseEvent<HTMLDivElement>, id: string) => void;
  onHandleMouseDown: (
    event: React.MouseEvent<HTMLDivElement>,
    id: string,
    handle: HandleDirection
  ) => void;
  onRequestUpload: () => void;
  onSelectSample: () => void;
}

export function CanvasPane({
  role,
  phase,
  title,
  instruction,
  imageSrc,
  rects,
  draftRect,
  selectedId,
  currentSourceId,
  containerRef,
  imageRef,
  isDrafting,
  onBackgroundMouseDown,
  onRectMouseDown,
  onHandleMouseDown,
  onRequestUpload,
  onSelectSample,
}: CanvasPaneProps) {
  // この pane の role に属する矩形のみ描画。
  const visibleRects = rects.filter((r) => r.role === role);

  return (
    <div className="canvas-wrapper">
      <div className="canvas-header">
        <span>{title}</span>
      </div>
      {instruction}
      <div className={`canvas-area phase-${phase}`}>
        {!imageSrc ? (
          <div className="upload-placeholder">
            <p>{role === 'source' ? '比較元の図面を選択' : '比較先の図面を選択'}</p>
            <button className="upload-btn" onClick={onRequestUpload}>
              アップロード
            </button>
            <button
              className="text-xs text-blue-500 mt-4 underline block mx-auto"
              onClick={onSelectSample}
            >
              サンプル{role === 'source' ? 'A' : 'B'}
            </button>
          </div>
        ) : (
          <div
            ref={containerRef}
            className={`image-container phase-${phase}`}
            onMouseDown={onBackgroundMouseDown}
          >
            <img ref={imageRef} src={imageSrc} alt={role} className="image-content" draggable={false} />

            {visibleRects.map((rect, index) => {
              let classNames = 'rect';
              let showLinkBadge = false;

              if (phase === 'define') {
                if (selectedId === rect.id) classNames += ' rect-selected';
              } else if (phase === 'select') {
                // Source は選択/紐付け状態を表示、Target は紐付け中は赤表示。
                if (rect.role === 'source') {
                  if (currentSourceId === rect.id) classNames += ' source-current';
                  else if ('linkedTargetIds' in rect && rect.linkedTargetIds.length > 0)
                    classNames += ' source-configured';

                  if ('linkedTargetIds' in rect && rect.linkedTargetIds.length > 0) showLinkBadge = true;
                } else if (rect.role === 'target') {
                  const currentSource = rects.find((r) => r.role === 'source' && r.id === currentSourceId);
                  if (currentSource && currentSource.linkedTargetIds.includes(rect.id)) {
                    classNames += ' target-linked';
                  }
                }
              }

              return (
                <div
                  key={rect.id}
                  className={classNames}
                  style={{
                    left: `${rect.x}%`,
                    top: `${rect.y}%`,
                    width: `${rect.width}%`,
                    height: `${rect.height}%`,
                  }}
                  onMouseDown={(event) => onRectMouseDown(event, rect.id)}
                >
                  <div className="rect-badge">{index + 1}</div>
                  {showLinkBadge && 'linkedTargetIds' in rect && (
                    <div className="link-badge">
                      <Link2 size={10} />
                      {rect.linkedTargetIds.length}
                    </div>
                  )}

                  {phase === 'define' && selectedId === rect.id && (
                    <>
                      {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                        <div
                          key={handle}
                          className={`resize-handle handle-${handle}`}
                          onMouseDown={(event) => onHandleMouseDown(event, rect.id, handle)}
                        />
                      ))}
                    </>
                  )}
                </div>
              );
            })}

            {isDrafting && draftRect && (
              <div
                className="rect"
                style={{
                  left: `${draftRect.x}%`,
                  top: `${draftRect.y}%`,
                  width: `${draftRect.width}%`,
                  height: `${draftRect.height}%`,
                  borderStyle: 'dashed',
                  borderColor: '#3b82f6',
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
