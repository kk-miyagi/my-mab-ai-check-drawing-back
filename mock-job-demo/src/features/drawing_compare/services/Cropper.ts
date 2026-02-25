export interface CropOptions {
  width?: number;
  height?: number;
}

export class Cropper {
  async crop(imageSrc: string, rect: { x: number; y: number; width: number; height: number }, options: CropOptions = {}): Promise<string> {
    // % 指定の矩形をピクセル座標に変換し、PNG data URL を返す。
    const img = await this.loadImage(imageSrc);

    const sx = (rect.x / 100) * img.naturalWidth;
    const sy = (rect.y / 100) * img.naturalHeight;
    const sw = (rect.width / 100) * img.naturalWidth;
    const sh = (rect.height / 100) * img.naturalHeight;

    const canvas = document.createElement('canvas');
    const targetWidth = options.width ?? Math.round(sw);
    const targetHeight = options.height ?? Math.round(sh);
    canvas.width = Math.max(1, targetWidth);
    canvas.height = Math.max(1, targetHeight);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }
}
