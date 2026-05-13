import React from 'react'
import Paper from '@mui/material/Paper';

type PreviewProps = {
  preview: string;
}

export const PdfPreview: React.FC<PreviewProps> = ({ preview }) => {
  return (
    <Paper
      elevation={3}
      sx={{
        width: '100%',
        maxHeight: '80vh',
        height: 'min(80vh, 2000px)',
        overflow: 'hidden',
        bgcolor: '#f8f9fa',
        borderRadius: 2,
        p: 0,
      }}
    >
      <iframe
        title="PDFプレビュー"
        src={`${preview}#page=1&view=FitH`}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          background: 'white',
        }}
      />
    </Paper>
  )
}