import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { SimilarSuggestion } from '../types.ts';
import {
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';

interface SuggestionScreenProps {
  title: string[];
  sourcePreview: string | null;
  suggestions: SimilarSuggestion[];
  selectedSuggestionIds: string[];
  onSelectSuggestion: (id: string) => void;
}

export function SuggestionScreen({
  title,
  sourcePreview,
  suggestions,
  selectedSuggestionIds,
  onSelectSuggestion,
}: SuggestionScreenProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(suggestions[0].id);
  }, [suggestions]);

  const active = suggestions.find((s) => s.id === activeId) ?? null;
  const isSelected = active ? selectedSuggestionIds.includes(active.id) : false;

  return (
    <Box>
      <Stack direction="row" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" gutterBottom>{title[0]}</Typography>
          {sourcePreview && (
            <>
            {/* 右側Buttonと同じ余白を追加 */}
            <Box sx={{ mb: 6 }} />
            <img src={sourcePreview} alt="source preview" style={{ width: '100%' }} />
            </>
          )}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" gutterBottom>{title[1]}</Typography>
          {suggestions.map((item) => {
            const tabSelected = selectedSuggestionIds.includes(item.id);
            return (
            <Button
              key={item.id}
              variant={activeId === item.id ? 'contained' : 'outlined'}
              color={tabSelected ? 'success' : 'primary'}
              size="small"
              sx={{
                mr: 1,
                mb: 1,
                minWidth: 0,
                px: 1.5,
                py: 0.5,
                fontWeight: activeId === item.id ? 'bold' : 'normal',
              }}
              startIcon={tabSelected ? <CheckCircle2 size={14} /> : undefined}
              onClick={() => setActiveId(item.id)}
            >
            <span className="score-pill">{item.score}</span>
            </Button>
            );
            })
          }
          {active && (
            <>
            <img src={active.image} alt={`suggestion-${active.id}`}  style={{ width: '100%' }}/>
            <Button
              variant={'outlined'}
              color="primary"
              onClick={() => onSelectSuggestion(active.id)}
            >
            {isSelected ? '解除' : '選択'}
            </Button>
            </>
            )}
        </Box>
      </Stack>
    </Box>
  );
}
