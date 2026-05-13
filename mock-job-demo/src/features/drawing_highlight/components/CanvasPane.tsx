import React from 'react';
import { Link2 } from 'lucide-react';
import type {
  RectModel,
  RectRole,
} from '../types.ts';
import {
  Box,
  Typography,
} from '@mui/material';

interface CanvasPaneProps {
  role: RectRole;
  title: string;
  imageSrc: string | null;
  rects: RectModel[];
  currentSourceId: string | null;
  containerRef: React.RefObject<HTMLDivElement>;
  imageRef: React.RefObject<HTMLImageElement>;
  onRectMouseDown: (event: React.MouseEvent<HTMLDivElement>, id: string) => void;
}


function HighlightBox({ rect, sx, index, showLinkBadge, onMouseDown }: { rect: any, sx: any, index: number, showLinkBadge: boolean, onMouseDown: (event: React.MouseEvent<HTMLDivElement>, id: string) => void }) {
  return (
    <Box
      key={rect.id}
      sx={{
        left: `${rect.x}%`,
        top: `${rect.y}%`,
        width: `${rect.width}%`,
        height: `${rect.height}%`,
        position: 'absolute',
        transition: 'all 0.1s',
        cursor: 'pointer',
        ...sx,
        pointerEvents: 'auto',
      }}
      onMouseDown={(event) => onMouseDown(event, rect.id)}
    >
      {/* 番号バッジ: 左上の上 */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: -22,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: 1,
          px: 1,
          py: 0.2,
          fontSize: 12,
          boxShadow: 1,
          zIndex: 2,
        }}
      >
        {index + 1}
      </Box>

      {/* リンクバッジ: 右下の下 */}
      {showLinkBadge && 'linkedTargetIds' in rect && (
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            bottom: -18,
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'secondary.main',
            color: 'secondary.contrastText',
            borderRadius: 1,
            px: 0.5,
            py: 0.1,
            fontSize: 10,
            boxShadow: 1,
            zIndex: 2,
          }}
        >
          <Link2 size={10} style={{ marginRight: 2 }} />
          {rect.linkedTargetIds.length}
        </Box>
      )}
    </Box>
  );
}

export function CanvasPane({
  role,
  title,
  imageSrc,
  rects,
  currentSourceId,
  containerRef,
  imageRef,
  onRectMouseDown,
}: CanvasPaneProps) {

  const visibleRects = rects.filter((r) => r.role === role).sort((a, b) => {
    const numA = Number(a.id.split("_")[1]);
    const numB = Number(b.id.split("_")[1]);
    return numA - numB
  })

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>

      <Box ref={containerRef}
        sx={{
          position: 'relative',
          backgroundColor: '#cbd5e1',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          userSelect: 'none',
          display: 'inline-block',
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 140px)',
          overflow: 'auto',
        }}
        
      >
        <img ref={imageRef} src={imageSrc ?? undefined} alt={role} className="image-content" draggable={false} />
        {visibleRects.map((rect, index) => {
          // source & current
          if (rect.role === 'source' && currentSourceId === rect.id) {
            return (
              <HighlightBox
                key={rect.id}
                rect={rect}
                sx={{
                  borderColor: '#0ea5e9',
                  backgroundColor: 'rgba(14, 165, 233, 0.2)',
                  opacity: 1,
                  zIndex: 20,
                  boxShadow: '0 0 0 4px rgba(14, 165, 233, 0.2)',
                }}
                index={index}
                showLinkBadge={true}
                onMouseDown={onRectMouseDown}
              />
            );
          }
          // source & linked
          if (rect.role === 'source' && 'linkedTargetIds' in rect && rect.linkedTargetIds.length > 0) {
            return (
              <HighlightBox
                key={rect.id}
                rect={rect}
                sx={{
                  borderColor: '#7dd3fc',
                  backgroundColor: 'rgba(14, 165, 233, 0.05)',
                  opacity: 0.8,
                }}
                index={index}
                showLinkBadge={true}
                onMouseDown={onRectMouseDown}
              />
            );
          }

          if (rect.role === 'source') {
            return (
              <HighlightBox
                key={rect.id}
                rect={rect}
                sx={{
                  borderColor: '#cbd5e1',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  opacity: 0.6,
                }}
                index={index}
                showLinkBadge={false}
                onMouseDown={onRectMouseDown}
              />
            );
          }
          // target & linked
          const currentSource = rects.find((r) => r.role === 'source' && r.id === currentSourceId);
          if (
            rect.role === 'target' &&
            currentSource &&
            'linkedTargetIds' in currentSource &&
            Array.isArray((currentSource as any).linkedTargetIds) &&
            (currentSource as any).linkedTargetIds.includes(rect.id)
          ) {
            return (
              <HighlightBox
                key={rect.id}
                rect={rect}
                sx={{
                  borderColor: '#f43f5e',
                  backgroundColor: 'rgba(244, 63, 94, 0.2)',
                  opacity: 1,
                  zIndex: 20,
                  boxShadow: '0 0 0 4px rgba(244, 63, 94, 0.2)',
                }}
                index={index}
                showLinkBadge={false}
                onMouseDown={onRectMouseDown}
              />
            );
          }
          // target (default)
          if (rect.role === 'target') {
            return (
              <HighlightBox
                key={rect.id}
                rect={rect}
                sx={{
                  borderColor: '#cbd5e1',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  opacity: 0.6,
                }}
                index={index}
                showLinkBadge={false}
                onMouseDown={onRectMouseDown}
              />
            );
          }
        })}
      </Box>
    </Box>
  );
}
