export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ChageRect {
  async crop(imageSrc: string, rect: { x: number; y: number; width: number; height: number }): Promise<Rect> {
    // 指定の座標をを画面の座標に変換
    const img = await this.loadImage(imageSrc);

    const x = Math.round(rect.x / img.naturalWidth * 100);
    const y = Math.round(rect.y / img.naturalHeight * 100);
    const w = Math.round(rect.width / img.naturalWidth * 100);
    const h = Math.round(rect.height / img.naturalHeight * 100);

    return {x: x, y: y, width: w, height: h};

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
