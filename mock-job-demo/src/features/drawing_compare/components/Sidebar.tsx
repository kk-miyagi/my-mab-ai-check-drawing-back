import React from 'react';
import { Edit3, Link2, Trash2 } from 'lucide-react';
import type { Phase, RectModel } from '../types.ts';

interface SidebarProps {
  phase: Phase;
  rects: RectModel[];
  selectedId: string | null;
  currentSourceId: string | null;
  onSelectRect: (id: string) => void;
  onSelectSourceForLink: (id: string) => void;
  onToggleTargetLink: (id: string) => void;
  onDelete: (id: string) => void;
}

export function Sidebar({
  phase,
  rects,
  selectedId,
  currentSourceId,
  onSelectRect,
  onSelectSourceForLink,
  onToggleTargetLink,
  onDelete,
}: SidebarProps) {
  const sources = rects.filter((r) => r.role === 'source');
  const targets = rects.filter((r) => r.role === 'target');
  const currentSourceIndex = sources.findIndex((r) => r.id === currentSourceId);
  const targetHeaderLabel =
    phase === 'define'
      ? 'Target (右)'
      : currentSourceId
        ? `Source #${currentSourceIndex + 1} の紐付け対象 (右)`
        : 'Target (右)';

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        {phase === 'define' ? (
          <div>
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <Edit3 size={18} /> 領域の確認
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              該当箇所が領域として認識されている確認してください。
            </p>
          </div>
        ) : (
          <div>
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <Link2 size={18} /> 個別紐付け設定
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              1. 左画面でSourceを選択
              <br />2. 右画面で紐付けるTargetを選択
              <br />
              <span className="text-xs text-slate-400">※Sourceごとに異なるTargetを設定できます</span>
            </p>
          </div>
        )}
      </div>

      <div className="sidebar-body">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500">
          Source (左)
        </div>
        <div className="list-container">
          {/* Source リスト: フェーズに応じて選択/紐付け用にクリック。 */}
          {sources.map((rect, index) => {
            const isCurrent = phase === 'select' && currentSourceId === rect.id;
            const linkedCount = rect.role === 'source' ? rect.linkedTargetIds.length : 0;

            return (
              <div
                key={rect.id}
                className={`list-item ${phase === 'define' && selectedId === rect.id ? 'selected-item' : ''} ${isCurrent ? 'source-current-item' : ''}`}
                onClick={() => {
                  // if (phase === 'define') onSelectRect(rect.id);
                  if (phase === 'select') onSelectSourceForLink(rect.id);
                }}
              >
                <div className="font-bold text-sm w-6">#{index + 1}</div>
                <div className="flex-1 text-xs text-slate-500">
                  {Math.round(rect.width)}% × {Math.round(rect.height)}%
                </div>

                {phase === 'select' && linkedCount > 0 && (
                  <div className="text-xs bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                    <Link2 size={10} /> {linkedCount}
                  </div>
                )}

                {/* {phase === 'define' && (
                  <button
                    className="text-slate-400 hover:text-red-500"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(rect.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )} */}
              </div>
            );
          })}
        </div>

        {(phase === 'define' || (phase === 'select' && currentSourceId)) && (
          <>
            <div className="px-4 py-2 bg-slate-50 border-y border-slate-200 font-bold text-xs text-slate-500 mt-4">
              {targetHeaderLabel}
            </div>
            <div className="list-container">
              {/* Target リスト: define では選択/削除のみ、select では現在の Source への紐付けをトグル。 */}
              {targets.map((rect, index) => {
                if (phase === 'define') {
                  return (
                    <div
                      key={rect.id}
                      className={`list-item ${selectedId === rect.id ? 'selected-item' : ''}`}
                      // onClick={() => onSelectRect(rect.id)}
                    >
                      <div className="font-bold text-sm w-6">#{index + 1}</div>
                      <div className="flex-1 text-xs text-slate-500">
                        {Math.round(rect.width)}% × {Math.round(rect.height)}%
                      </div>
                      {/* <button
                        className="text-slate-400 hover:text-red-500"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(rect.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button> */}
                    </div>
                  );
                }

                const currentSource = rects.find((r) => r.role === 'source' && r.id === currentSourceId);
                const isLinked = currentSource?.role === 'source' && currentSource.linkedTargetIds.includes(rect.id);

                return (
                  <div
                    key={rect.id}
                    className={`list-item ${isLinked ? 'target-linked-item' : ''}`}
                    onClick={() => onToggleTargetLink(rect.id)}
                  >
                    <div className="font-bold text-sm w-6">#{index + 1}</div>
                    <div className="flex-1 text-xs text-slate-500">
                      {Math.round(rect.width)}% × {Math.round(rect.height)}%
                    </div>
                    {isLinked && <span className="text-rose-500 text-xs font-bold">紐付け済み</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
