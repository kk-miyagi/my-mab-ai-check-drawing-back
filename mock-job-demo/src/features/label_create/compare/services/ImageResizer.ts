export class ImageResizer {
  private readonly maxDimension = 1800; // 画像が大きすぎる場合に縮小する上限ピクセル

  async resizeIfNeeded(dataUrl: string): Promise<string> {
    const img = await this.loadImage(dataUrl);
    const { naturalWidth, naturalHeight } = img;

    const maxSide = Math.max(naturalWidth, naturalHeight);
    if (maxSide <= this.maxDimension) {
      return dataUrl; // 上限以下ならそのまま返す
    }

    const scale = this.maxDimension / maxSide;
    const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
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
