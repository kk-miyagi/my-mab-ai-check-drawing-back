import React, { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react';
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

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.xlsm'];
const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
];

export const isSupportedExcelFile = (file: File): boolean => {
  const lowerName = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return true;
  }
  return ACCEPTED_MIME_TYPES.includes(file.type);
};

type InputExcelFileProps = {
  onFileChange?: (file: File | null) => void;
};

export const InputExcelFile: React.FC<InputExcelFileProps> = ({
  onFileChange,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const acceptValue = useMemo(() => ACCEPTED_EXTENSIONS.join(','), []);

  const setSelectedFile = (nextFile: File | null) => {
    setFile(nextFile);
    onFileChange?.(nextFile);
  };

  const pickFile = (files: readonly File[]) => {
    if (files.length === 0) {
      return;
    }

    const target = files[0];
    if (!isSupportedExcelFile(target)) {
      setErrorMessage('Excelファイル(.xlsx, .xls, .xlsm)を選択してください。');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(target);
  };

  const handleSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    pickFile(Array.from(fileList));

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

    pickFile(Array.from(droppedFiles));
  };

  const handleClear = () => {
    setErrorMessage(null);
    setSelectedFile(null);
  };

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
          direction={{ xs: 'column', sm: 'row' }}
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
              onChange={handleSelectFile}
            />
          </Button>
          <Chip
            label={file ? `選択中: ${file.name}` : '未選択'}
            color={file ? 'primary' : 'default'}
            variant="outlined"
          />
          <Button variant="text" color="error" onClick={handleClear} disabled={!file}>
            削除
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
          ここにファイルをドラッグ＆ドロップできます
        </Typography>
        {errorMessage && (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
            {errorMessage}
          </Typography>
        )}
      </Paper>
    </Stack>
  );
};
