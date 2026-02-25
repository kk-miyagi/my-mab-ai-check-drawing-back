import React from 'react';
import { Sparkles } from 'lucide-react';
import type { SimilarSuggestion } from '../types.ts';

interface SuggestionPanelProps {
  sourcePreview: string | null;
  suggestions: SimilarSuggestion[];
  loading: boolean;
}

export function SuggestionPanel({ sourcePreview, suggestions, loading }: SuggestionPanelProps) {
  return (
    <div className="suggestion-panel">
      <div className="suggestion-header">
        <span className="label">選択中の基準</span>
      </div>
      <div className="preview-box">
        {sourcePreview ? <img src={sourcePreview} alt="source preview" /> : <div className="placeholder">Sourceを選択してください</div>}
      </div>

      <div className="suggestion-header" style={{ marginTop: '12px' }}>
        <span className="label">類似候補（上位3件）</span>
        <span className="badge">
          <Sparkles size={14} />
          擬似スコア
        </span>
      </div>
      <div className="suggestion-list">
        {loading && <div className="placeholder">計算中...</div>}
        {!loading && suggestions.length === 0 && <div className="placeholder">Target画像がありません</div>}
        {!loading && suggestions.map((item) => (
          <div key={item.id} className="suggestion-card">
            <div className="score">{item.score.toFixed(1)}%</div>
            <div className="thumb">
              <img src={item.image} alt={`suggestion-${item.id}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
