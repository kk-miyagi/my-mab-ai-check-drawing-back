from PIL import Image
from pathlib import Path
import argparse


def cut_images(
    image_path: str,
    rects: list[list[int, int, int, int]],
    output_dir: str,
) -> list[str]:

    image_path = Path(image_path)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(image_path) as img:

        saved_paths = []
        for i, (x, y, w, h) in enumerate(rects):
            # 左上・右下座標に変換
            x1 = x
            y1 = y
            x2 = x + w
            y2 = y + h

            crop = img.crop((x1, y1, x2, y2))

            out_path = out_dir / f"{image_path.stem}_cut_{i}.jpg"
            crop.save(out_path)
            saved_paths.append(str(out_path))

        return saved_paths


if __name__ == "__main__":
    # 実行確認用

    def parse_row(ints: list):
        try:
            if len(ints) % 4 != 0:
                raise argparse.ArgumentTypeError('要素数が違うようです。')
            return [ints[i:i+4] for i in range(0, len(ints), 4)]

        except ValueError:
            raise argparse.ArgumentTypeError(f"行のパースに失敗")

    parser = argparse.ArgumentParser(description="座標から画像を切り出す")
    parser.add_argument("--image-path", required=True, help="元画像のファイルパス")
    parser.add_argument("--rects", type=int, nargs="+",
                        required=True, help="座標一覧(カンマ区切りで渡す)")
    parser.add_argument("--output-dir", required=True, help="出力先")

    args = parser.parse_args()
    rects = parse_row(args.rects)
    print(f"座標一覧: {rects}")

    paths = cut_images(args.image_path, rects, args.output_dir)
    print("Saved:", paths)
