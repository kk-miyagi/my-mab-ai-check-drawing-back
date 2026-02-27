import React from 'react';
import { ArrowRightLeft, ChevronRight, Edit3, Grid, Trash2 } from 'lucide-react';
import type { Phase } from '../types.ts';

interface HeaderSectionProps {
  phase: Phase;
  hasRects: boolean;
  canProceed: boolean;
  canCompare: boolean;
  onClearAll: () => void;
  onGoNext: () => void;
  onBackToDefine: () => void;
  onBackToSelect?: () => void;
  onRunComparison: () => void;
}

export function HeaderSection({
  phase,
  hasRects,
  canProceed,
  canCompare,
  onClearAll,
  onGoNext,
  onBackToDefine,
  onBackToSelect,
  onRunComparison,
}: HeaderSectionProps) {
  return (
    <header className="header">
      <div className="header-title">
        <div className="icon-wrapper">
          <Grid size={20} />
        </div>
        <h1>図面比較システム</h1>
      </div>

      <div className="step-indicator">
        <div className={`step-item ${phase === 'define' ? 'active' : ''}`}>
          <div className="step-number">1</div>
          <span>領域確認</span>
        </div>
        <ChevronRight size={16} className="text-slate-400" />
        <div className={`step-item ${phase === 'select' || phase === 'suggest' ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <span>比較元選択</span>
        </div>
        <ChevronRight size={16} className="text-slate-400" />
        <div className={`step-item ${phase === 'suggest' ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <span>候補確認</span>
        </div>
      </div>

      <div className="header-actions">
        {phase === 'define' ? (
          <>
            {/* <button className="btn btn-danger" onClick={onClearAll} disabled={!hasRects}>
              <Trash2 size={16} /> 全削除
            </button> */}
            <p></p>
            <div className="divider" />
            <button className="btn btn-primary" onClick={onGoNext} disabled={!canProceed}>
              次へ：紐付け設定 <ChevronRight size={16} />
            </button>
          </>
        ) : phase === 'select' ? (
          <>
            <button className="btn btn-outline" onClick={onBackToDefine}>
              <Edit3 size={16} /> 領域を修正
            </button>
            <div className="divider" />
            <button
              className="btn btn-compare"
              style={{ backgroundColor: '#0f172a', color: 'white' }}
              disabled={!canCompare}
              onClick={onRunComparison}
            >
              <ArrowRightLeft size={16} /> 比較実行
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-outline" onClick={onBackToSelect}>
              <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> 比較元選択に戻る
            </button>
            <div className="divider" />
            <button className="btn btn-compare" style={{ backgroundColor: '#94a3b8', color: 'white' }} disabled>
              <ArrowRightLeft size={16} /> 候補確認中
            </button>
          </>
        )}
      </div>
    </header>
  );
}
