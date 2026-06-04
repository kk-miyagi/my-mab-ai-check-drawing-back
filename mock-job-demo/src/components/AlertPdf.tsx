import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Typography
} from '@mui/material';

type AlertPdfProps = {
  pdfError: string[];
};

export const AlertPdf: React.FC<AlertPdfProps> = ({ pdfError }) => {
  if (pdfError.length === 0) {
    return null;
  }
  return (
    <Alert severity="error" sx={{ mb: 2 }}>
      <AlertTitle>以下の図面が複数ページです。1ページの図面を選択してください。</AlertTitle>
      <Box component="ul">
        {pdfError.map((name) => (
          <li key={name}>
            <Typography variant="body2">{name}</Typography>
          </li>
        ))}
      </Box>
    </Alert>
  );
}
