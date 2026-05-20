import React from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import { PdfPreview } from './PdfPreview';
import { ImagePreview } from './ImagePreview';
import type { UploadFileItem } from './InputFiles';

type PreviewFilesProps = {
  items: UploadFileItem[];
  selectedItemId: string | null;
  currentItem: UploadFileItem | null;
  rightPanel?: React.ReactNode;
  onSelectItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
};

export const PreviewFiles: React.FC<PreviewFilesProps> = ({
  items,
  selectedItemId,
  currentItem,
  rightPanel,
  onSelectItem,
  onRemoveItem,
}) => {
  return (
    <>
      {items.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">プレビュー対象を選択</Typography>
          <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
            {items.map((item) => {
              const isSelected = item.id === selectedItemId;
              return (
                <Paper
                  key={item.id}
                  variant="outlined"
                  sx={{
                    px: 1,
                    py: 0.75,
                    minWidth: 220,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    opacity: isSelected ? 1 : 0.65,
                    backgroundColor: isSelected ? '#eef6ff' : 'background.paper',
                  }}
                >
                  <Button
                    variant="text"
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      minWidth: 0,
                      flexGrow: 1,
                      px: 0.5,
                    }}
                    onClick={() => onSelectItem(item.id)}
                  >
                    <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                      <Typography variant="body2" noWrap title={item.file.name}>{item.file.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{(item.file.size / 1024 / 1024).toFixed(2)} MB</Typography>
                    </Box>
                  </Button>
                  <IconButton color="error" size="small" onClick={() => onRemoveItem(item.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Paper>
              );
            })}
          </Box>
        </Stack>
      )}

      {currentItem && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
            {currentItem.kind === 'pdf' && (
              <PdfPreview preview={currentItem.previewUrl} />
            )}
            {currentItem.kind === 'image' && (
              <ImagePreview file={currentItem.file} url={currentItem.previewUrl} />
            )}
          </Box>
          {rightPanel && (
            <Box sx={{ flexShrink: 0, width: 280 }}>
              {rightPanel}
            </Box>
          )}
        </Box>

      )}
    </>
  );
};
