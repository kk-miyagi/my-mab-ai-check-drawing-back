import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ImageOff, Loader2 } from 'lucide-react';
import type { SimilarSuggestion } from '../types.ts';

interface SuggestionScreenProps {
  sourcePreview: string | null;
  suggestions: SimilarSuggestion[];
  loading: boolean;
  currentSourceLabel?: string;
  selectedSuggestionIds: string[];
  onSelectSuggestion: (id: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export function SuggestionScreen({
  sourcePreview,
  suggestions,
  loading,
  currentSourceLabel,
  selectedSuggestionIds,
  onSelectSuggestion,
  onBack,
  onConfirm,
}: SuggestionScreenProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (suggestions.length === 0) {
      setActiveId(null);
    } else if (!activeId || !suggestions.some((s) => s.id === activeId)) {
      setActiveId(suggestions[0].id);
    }
  }, [suggestions, activeId]);

  const active = suggestions.find((s) => s.id === activeId) ?? null;
  const isSelected = active ? selectedSuggestionIds.includes(active.id) : false;

  return (
    <div className="suggestion-screen">
      <div className="suggestion-actions">
        <button
          className="btn btn-primary"
          onClick={onConfirm}
          disabled={loading || (suggestions.some((s) => s.targetId) && selectedSuggestionIds.length === 0)}
        >
          完了して戻る
        </button>
      </div>

      <div className="suggestion-main">
        <div className="suggestion-pane">
          <div className="pane-header">切り取った比較元</div>
          <div className="pane-body preview-large">
            {/* 候補の文脈になるよう、必ず Source の切り抜きを表示。 */}
            {sourcePreview ? (
              <img src={sourcePreview} alt="source preview" />
            ) : (
              <div className="placeholder">
                <ImageOff size={20} />
                <div>Sourceが未選択です</div>
              </div>
            )}
          </div>
        </div>

        <div className="suggestion-pane">
          <div className="pane-header">類似候補から選択</div>
          <div className="pane-body">
            {loading && (
              <div className="placeholder">
                <Loader2 className="spin" size={18} /> 計算中...
              </div>
            )}
            {!loading && suggestions.length === 0 && (
              <div className="placeholder">
                <ImageOff size={20} /> Target画像がありません
              </div>
            )}

            {!loading && suggestions.length > 0 && (
              <>
                <div className="candidate-tabs">
                  {suggestions.map((item, index) => {
                    const tabSelected = selectedSuggestionIds.includes(item.id);
                    const label = item.label ?? `候補 ${index + 1}`;
                    return (
                      <button
                        key={item.id}
                        className={`candidate-tab ${activeId === item.id ? 'active' : ''} ${tabSelected ? 'selected' : ''}`}
                        onClick={() => setActiveId(item.id)}
                      >
                        <span className="tab-label">{label}</span>
                        <span className="score-pill">{item.score.toFixed(1)}%</span>
                        {tabSelected && <CheckCircle2 size={14} />}
                      </button>
                    );
                  })}
                </div>

                {active && (
                  <div className="candidate-detail">
                    <div className="candidate-preview">
                      {active.image ? (
                        <img src={active.image} alt={`suggestion-${active.id}`} />
                      ) : (
                        <div className="placeholder">
                          <ImageOff size={18} /> プレビューが取得できません
                        </div>
                      )}
                    </div>

                    <div className="candidate-meta">
                      <div className="meta-row">
                        <span className="meta-label">スコア</span>
                        <span className="score-pill large">{active.score.toFixed(1)}%</span>
                      </div>

                      <div className="meta-actions">
                        <button
                          className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => onSelectSuggestion(active.id)}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 size={16} /> 選択中（クリックで解除）
                            </>
                          ) : (
                            'この候補を選択'
                          )}
                        </button>
                        <p className="meta-note">クリックでこの候補をSourceに紐付けます。</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
