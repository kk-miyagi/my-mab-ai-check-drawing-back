import React, { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Chip,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import {
  UploadFile
} from '@mui/icons-material';
import { PreviewFiles } from './PreviewFiles';

const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.pdf'];

export type UploadFileKind = 'image' | 'pdf';

export type UploadFileItem = {
  id: string;
  file: File;
  kind: UploadFileKind;
  previewUrl: string;
};

const isPdfFile = (file: File): boolean => {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
};

const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/');
};

export const isSupportedUploadFile = (file: File): boolean => {
  return isPdfFile(file) || isImageFile(file);
};

export const toUploadFileItems = (files: readonly File[]): UploadFileItem[] => {
  return files
    .filter(isSupportedUploadFile)
    .map((file) => {
      const kind: UploadFileKind = isPdfFile(file) ? 'pdf' : 'image';
      return {
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        kind,
        previewUrl: URL.createObjectURL(file),
      };
    });
};

export const revokeUploadFileItems = (items: readonly UploadFileItem[]): void => {
  items.forEach((item) => {
    URL.revokeObjectURL(item.previewUrl);
  });
};

type InputFilesProps = {
  onFilesChange?: (files: File[]) => void;
  onItemsChange?: (items: UploadFileItem[]) => void;
  onCurrentItemChange?: (currentItem: UploadFileItem | null) => void;
  rightPanel?: React.ReactNode;
};

export const InputFile: React.FC<InputFilesProps> = ({
  onFilesChange,
  onItemsChange,
  onCurrentItemChange,
  rightPanel,
}) => {
  const [items, setItems] = useState<UploadFileItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false); // ドラッグ状態の管理
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<UploadFileItem[]>([]);

  const acceptValue = useMemo(() => ACCEPTED_EXTENSIONS.join(','), []);

  const notifyChange = (nextItems: UploadFileItem[]) => {
    onFilesChange?.(nextItems.map((item) => item.file));
    onItemsChange?.(nextItems);
  };

  const appendFiles = (files: readonly File[]) => {
    if (files.length === 0) {
      return;
    }

    // 単一ファイルのみ受け付ける。新しいファイルが選択されたら既存を置き換える。
    const firstFile = Array.from(files).find(isSupportedUploadFile);
    if (!firstFile) {
      return;
    }

    const nextPickedItems = toUploadFileItems([firstFile]);
    if (nextPickedItems.length === 0) {
      return;
    }

    // 既存アイテムの previewUrl を解放
    revokeUploadFileItems(items);

    const nextItems = nextPickedItems;
    setSelectedItemId(nextItems[0].id);
    setItems(nextItems);
    notifyChange(nextItems);
  };

  const handleSelectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    appendFiles(Array.from(fileList));

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const droppedFiles = event.dataTransfer?.files;
    if (!droppedFiles || droppedFiles.length === 0) {
      return;
    }

    // 単一ファイルのみ受け付ける
    appendFiles([droppedFiles[0]]);
  };

  const handleRemove = (targetId: string) => {
    const target = items.find((item) => item.id === targetId);
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
    }

    const nextItems = items.filter((item) => item.id !== targetId);
    if (selectedItemId === targetId) {
      setSelectedItemId(nextItems.length > 0 ? nextItems[0].id : null);
    }
    setItems(nextItems);
    notifyChange(nextItems);
  };

  const handleClear = () => {
    revokeUploadFileItems(items);
    setItems([]);
    setSelectedItemId(null);
    notifyChange([]);
  };

  useEffect(() => {
    if (items.length === 0) {
      if (selectedItemId !== null) {
        setSelectedItemId(null);
      }
      return;
    }

    if (!selectedItemId || !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      revokeUploadFileItems(itemsRef.current);
    };
  }, []);

  const currentItem = items.find((item) => item.id === selectedItemId) ?? null;

  useEffect(() => {
    onCurrentItemChange?.(currentItem);
  }, [currentItem, onCurrentItemChange]);

  return (
    <Stack spacing={2}>
      <Paper
        variant="outlined"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          borderStyle: 'dashed',
          borderWidth: 2,
          p: 3,
          borderRadius: 2,
          backgroundColor: isDragging ? '#e3f2fd' : '#f8fbff',
          borderColor: isDragging ? 'primary.main' : 'divider',
          transition: 'all 0.2s ease',
          textAlign: 'center'
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row'}}
          spacing={2}
          sx={{ justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Button component="label" variant="contained" startIcon={<UploadFile />}>
            ファイルを選択
            <input
              ref={inputRef}
              hidden
              type="file"
              accept={acceptValue}
              onChange={handleSelectFiles}
            />
          </Button>
          <Chip label={`選択中: ${items.length}`} color="primary" variant="outlined" />
          <Button variant="text" color="error" onClick={handleClear} disabled={items.length === 0}>
            すべて削除
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
          ここにファイルをドラッグ＆ドロップできます
        </Typography>
      </Paper>

      <PreviewFiles
        items={items}
        selectedItemId={selectedItemId}
        currentItem={currentItem}
        rightPanel={rightPanel}
        onSelectItem={setSelectedItemId}
        onRemoveItem={handleRemove}
      />
    </Stack>
  );
};