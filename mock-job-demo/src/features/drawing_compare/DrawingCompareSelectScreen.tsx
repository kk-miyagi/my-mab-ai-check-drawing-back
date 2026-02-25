import React, { useEffect, useState, useRef, ChangeEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'

const DEFAULT_EPIC = 'drawing-compare';
const DEFAULT_OPERATION = 'select';

export const DrawingCompareSelectScreen: React.FC = () => {

  const [baseImageFile, setBaseImageFile] = useState<File[]>([]);
  const [baseImagepreview, setBaseImagePreview] = useState<string | null>(null);

  const imgRef = useRef(null);

  const handleSetBaseImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setBaseImageFile([selectedFile]);
      setBaseImagePreview(URL.createObjectURL(selectedFile));
    } else {
      setBaseImageFile([]);
      setBaseImagePreview(null);
    }
  };

  const [croppedImg, setCroppedImg] = useState<string[]>([])

  useEffect (() => {
    setCroppedImg([])
    if (baseImageFile.length > 0 && imgRef.current) {
      const img: HTMLImageElement = imgRef.current;
      const canvas = document.createElement("canvas");
      
      const crops = [{ x: 100, y: 80, width: 240, height: 180 }, { x: 0, y: 80, width: 240, height: 180 }];

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      img.onload = () => {
        Object.keys(crops).forEach((i) => {
          console.log(i)
          ctx.drawImage(
            img,
            crops[i].x,
            crops[i].y,
            crops[i].width,
            crops[i].height,
            0,
            0,
            crops[i].width,
            crops[i].height
          );
          const cropped = canvas.toDataURL();
    
          setCroppedImg(prev => [...prev, cropped]);
        })}

    } else {
      setCroppedImg([])
    }
  }, [baseImageFile])

  useEffect(() => {
    return () => {
      if (baseImagepreview) {
        URL.revokeObjectURL(baseImagepreview);
      }
    };
  }, [baseImagepreview]);

  useEffect(() => {
    return () => {
      if (croppedImg.length > 0) {
        croppedImg.map((v) => URL.revokeObjectURL(v))
      }
    };
  }, [croppedImg]);



  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>図面比較</h1>
        <Link to="/hub">前に戻る</Link>
      </div>

      <h3>基準側ラベル付与済み図面</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept="image/*" onChange={handleSetBaseImageFile} />
          </label>
        </div>
      </div>

      {baseImagepreview && (
        <div style={{ marginBottom: '15px' }}>
          <img src={baseImagepreview} ref={imgRef} alt='プレビュー' style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />
        </div>
      )}

      {croppedImg.length > 0 && (
        <div>
          <h3>切り取った画像</h3>
          {croppedImg.map((v) => (<img src={v} alt="cropped" />))}
        </div>
      )}

    </div>
  )
}
