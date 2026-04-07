import React from 'react'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

type ImageFile = {
  file: File;
  url: string;
}

export const ImagePreview: React.FC<ImageFile> = ({ file, url }) => {
  return (
    <TransformWrapper>
      <TransformComponent>
        <img
          src={url}
          alt={file.name}
          style={{
            width: '100%',
            maxHeight: '2000px',
            objectFit: 'contain'
          }}
        />
      </TransformComponent>
    </TransformWrapper>
  )
}
