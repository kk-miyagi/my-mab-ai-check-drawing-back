import React from 'react';
import { Link2 } from 'lucide-react';
import type {
  DraftRect,
  HandleDirection,
  Phase,
  RectModel,
  RectRole,
} from '../types.ts';
import { useEffect, useState } from 'react';
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
  crops: {}[]
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
  crops,
}: CanvasPaneProps) {
  // この pane の role に属する矩形のみ描画。
  const visibleRects = rects.filter((r) => r.role === role);

  const [scale, setScale] = useState<{ x: number; y: number } | null>(null);


  const handleImageLoad = () => {
    const img = imageRef.current;
    if (!img) return;
    setScale({
      x: img.clientWidth / img.naturalWidth,
      y: img.clientHeight / img.naturalHeight,
    });
  }

  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    handleImageLoad();

    const observer = new ResizeObserver(handleImageLoad);
    observer.observe(img);

    return () => observer.disconnect();
  }, [imageSrc]);

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
          {scale && 
            crops.map((crop) => (
              <div className="rect" key={crop.id} style={{
              position: "absolute",
              left: crop.x * scale.x,
              top: crop.y * scale.y,
              width: crop.width * scale.x,
              height: crop.height * scale.y,
              borderStyle: 'dashed',
              borderColor: '#3b82f6',
              }}/>
            ))
          }
          </div>
        )}
      </div>
    </div>
  );
}


// import React, {  } from 'react';
// import { Link2 } from 'lucide-react';
// import type {
//   DraftRect,
//   HandleDirection,
//   Phase,
//   RectModel,
//   RectRole,
// } from '../types.ts';


// interface CanvasPaneProps {
//   phase: Phase;
//   title: string;
//   imageSrc: string | null;
//   imageRef: React.RefObject<HTMLImageElement>;
//   crops: {}[]
// }

// export function CanvasPane({
//   phase,
//   title,
//   imageSrc,
//   imageRef,
//   crops

// }: CanvasPaneProps) {

//   const [scale, setScale] = useState<{ x: number; y: number } | null>(null);


//   const handleImageLoad = () => {
//     const img = imageRef.current;
//     if (!img) return;
//     setScale({
//       x: img.clientWidth / img.naturalWidth,
//       y: img.clientHeight / img.naturalHeight,
//     });
//   }


//   useEffect(() => {
//     const img = imageRef.current;
//     if (!img) return;

//     handleImageLoad();

//     const observer = new ResizeObserver(handleImageLoad);
//     observer.observe(img);

//     return () => observer.disconnect();
//   }, [imageSrc]);



//   return (
//     <div className="canvas-wrapper">
//       <div className="canvas-header">
//         <span>{title}</span>
//       </div>
//       <div className={`canvas-area phase-${phase}`}>
//         <div className={`image-container phase-${phase}`}>
//           {imageSrc && (
//             <img ref={imageRef} src={imageSrc} className="image-content" draggable={false} onLoad={handleImageLoad}/>
//           )}
//           {scale && 
//             crops.map((crop) => (
//               <div className="rect" key={crop.id} style={{
//               position: "absolute",
//               left: crop.x * scale.x,
//               top: crop.y * scale.y,
//               width: crop.width * scale.x,
//               height: crop.height * scale.y,
//               borderStyle: 'dashed',
//               borderColor: '#3b82f6',
//               }}/>
//             ))
//           }  
//         </div>
//       </div>
//     </div>
//   );
// }
