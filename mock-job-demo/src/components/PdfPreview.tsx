import React from 'react'

type PreviewProps = {
  preview: string;
}

export const PdfPreview: React.FC<PreviewProps> = ({ preview }) => {
  return (
    <div
      style={{
        width: '100%',
        maxHeight: '2000px',
        height: 'min(80vh, 2000px)',
        border: '1px solid #ddd',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#f8f9fa',
      }}
    >
      <iframe
        title="PDFプレビュー"
        src={preview}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          background: 'white',
        }}
      />
    </div>
  )
}