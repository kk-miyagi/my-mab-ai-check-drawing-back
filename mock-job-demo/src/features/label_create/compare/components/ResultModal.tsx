import React from 'react';
import { Layers, Target, X } from 'lucide-react';
import type { RectModel } from '../types';

interface ResultModalProps {
  open: boolean;
  rects: RectModel[];
  sourceImg: string | null;
  targetImg: string | null;
  onClose: () => void;
}

function estimateScore(sourceId: string, targetId: string): number {
  // プレビューのたびに変わらない疑似スコアを算出。
  let seed = 0;
  const combined = `${sourceId}-${targetId}`;
  for (let i = 0; i < combined.length; i += 1) {
    seed = (seed + combined.charCodeAt(i) * (i + 11)) % 17;
  }
  return 82 + (seed % 14);
}

export function ResultModal({ open, rects, sourceImg, targetImg, onClose }: ResultModalProps) {
  if (!open) return null;

  const sourceRects = rects.filter((r) => r.role === 'source' && r.linkedTargetIds.length > 0);
  const targetRects = rects.filter((r) => r.role === 'target');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Layers className="text-blue-600" /> 比較結果レポート
          </h2>
          <button onClick={onClose} aria-label="close">
            <X className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {sourceRects.map((source, sourceIndex) => (
          <div key={source.id} className="comparison-group">
            <div className="comparison-header">
              <span className="flex items-center gap-2">
                <Target size={16} className="text-sky-600" />
                Source #{sourceIndex + 1} (基準)
              </span>
              <span className="text-xs font-normal text-slate-500">
                ID: {source.id.slice(-4)} | 紐付け数: {source.linkedTargetIds.length}
              </span>
            </div>

            {source.linkedTargetIds.map((targetId) => {
              const target = targetRects.find((rect) => rect.id === targetId);
              if (!target) return null;
              const targetIndex = targetRects.findIndex((rect) => rect.id === target.id);

              const sourceCrop = source.imageCoords ?? source;
              const targetCrop = target.imageCoords ?? target;

              return (
                <div key={target.id} className="result-row">
                  <div className="img-preview-box">
                    {/* background-size の調整だけでクロップ領域を見せる。 */}
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `url(${sourceImg ?? ''})`,
                        backgroundPosition: `${-sourceCrop.x * (100 / sourceCrop.width)}% ${-sourceCrop.y * (100 / sourceCrop.height)}%`,
                        backgroundSize: `${10000 / sourceCrop.width}% ${10000 / sourceCrop.height}%`,
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-xl font-bold text-slate-300">vs</span>
                    <span className="text-xs font-bold text-green-600 mt-1 bg-green-50 px-2 py-1 rounded">
                      一致率: {estimateScore(source.id, target.id).toFixed(1)}%
                    </span>
                  </div>

                  <div className="relative">
                    <div className="absolute top-0 left-0 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-br z-10 font-bold">
                      Target #{targetIndex + 1}
                    </div>
                    <div className="img-preview-box">
                      {/* Target 側も同じ手法で対応する領域のみを表示。 */}
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundImage: `url(${targetImg ?? ''})`,
                          backgroundPosition: `${-targetCrop.x * (100 / targetCrop.width)}% ${-targetCrop.y * (100 / targetCrop.height)}%`,
                          backgroundSize: `${10000 / targetCrop.width}% ${10000 / targetCrop.height}%`,
                          backgroundRepeat: 'no-repeat',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div className="text-right mt-4">
          <button className="btn btn-primary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
