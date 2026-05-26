"""Update-label batch task.

Re-numbers user-edited rectangles via the manga-panel sort, redraws labels on
the source image, exports a PDF and a CSV. Logic was previously inline in the
api_server/router/update_label.py route.
"""

import argparse
import os
from pathlib import Path
from typing import Dict, List, Optional

import img2pdf
from PIL import Image, ImageDraw, ImageFont

from common.tools.sort_manga_panels import sort_mange_panels


def _annotate_matches(
    image_path: Path,
    matches: List[Dict[str, object]],
    output_dir: str,
    *,
    suffix: str = "_annotated_dims",
    outline=("red"),
    label_prefix: str = "",
    start_index: int = 1,
    box_on: bool = True,
) -> Optional[Path]:
    if not matches:
        return None

    annotated_path = image_path.with_name(
            f"{image_path.stem}{suffix}{image_path.suffix}")
    with Image.open(image_path).convert("RGB") as img:
        drawer = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("arial.ttf", size=40)
        except Exception:
            try:
                font = ImageFont.truetype("DejaVuSans.ttf", size=40)
            except Exception:
                font = ImageFont.load_default()
        for idx, match in enumerate(matches, start=start_index):
            rect = match.get("rect")
            if not rect:
                continue
            if box_on:
                drawer.rectangle(rect, outline=outline, width=4)
            label_text = (
                f"{label_prefix}{idx}" if label_prefix else str(idx))
            if hasattr(font, "getbbox"):
                bbox = font.getbbox(label_text)
                label_height = bbox[3] - bbox[1]
                label_weight = bbox[2] - bbox[0]
            else:
                label_height = 14
                label_weight = 40 * 2
                if hasattr(font, "getsize"):
                    label_height = font.getsize(label_text)[1]
            label_x = rect[0]
            label_y = max(rect[1] - label_height - 4, 0)
            if not box_on and ((rect[3] - rect[1]) > 2 * label_height):
                label_y = min(rect[1] + label_height + 4, rect[3])
            if not box_on and ((rect[2] - rect[0]) * 0.7 < label_weight):
                label_x = min(rect[0] - label_weight - 4, rect[0])

            drawer.text(
                (label_x, label_y), label_text, fill=outline, font=font)
        if not os.path.isdir(output_dir):
            os.makedirs(output_dir)
        output_path = Path(f"{output_dir}/{annotated_path.name}")
        img.save(output_path)
    return output_path


def run(params: dict) -> None:
    """Worker entrypoint.

    Required keys:
      input_img:  absolute path to the source image (.jpg/.jpeg)
      output_dir: where annotated image / pdf / csv are written
      rects:      {key: [x1, y1, x2, y2]} from the user
      info:       {key: [item, value, note]} from the user
    """
    _run_update(
        params['input_img'],
        params['output_dir'],
        params['rects'],
        params['info'],
    )


def _run_update(
        input_img: str,
        output_dir: str,
        rects_dict: dict,
        info_dict: dict):
    rect_list = list(rects_dict.values())
    sorted_rects = sort_mange_panels(rect_list)
    rect_to_key = {tuple(v): k for k, v in rects_dict.items()}
    sorted_old_keys = [
            rect_to_key[tuple(rect)] for rect in sorted_rects]

    rects_dict = {
        i: rects_dict[k]
        for i, k in enumerate(sorted_old_keys, start=1)
    }
    info_dict = {
        i: info_dict[k] for i, k in enumerate(sorted_old_keys, start=1)
    }

    ordered_matches = [
        {"id": str(k), "rect": v} for k, v in rects_dict.items()
    ]

    annotated_path = _annotate_matches(
        Path(input_img),
        ordered_matches,
        suffix="_update_label",
        outline=(220, 20, 60),
        output_dir=output_dir,
        box_on=True,
    )
    print("Annotated image saved at:", annotated_path)

    new_file_name = Path(annotated_path).with_suffix(".pdf")
    with open(new_file_name, "wb") as f:
        f.write(img2pdf.convert(Path(annotated_path)))
    print("Annotated PDF saved at:", new_file_name)

    csv_path = f"{output_dir}/info.csv"
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("No,項目,寸法値または品質指定等の記載内容,備考\n")
        for key, info in info_dict.items():
            f.write(f"{key},{info[0]},{info[1]},{info[2]}\n")
    print("Info CSV saved at:", csv_path)


if __name__ == '__main__':
    import json
    parser = argparse.ArgumentParser(description="ラベル付与編集")
    parser.add_argument("--input-img", type=str, required=True)
    parser.add_argument("--output-dir", type=str, required=True)
    parser.add_argument(
            "--rects-json", type=str, required=True,
            help="path to JSON: {key: [x1,y1,x2,y2]}")
    parser.add_argument(
            "--info-json", type=str, required=True,
            help="path to JSON: {key: [item, value, note]}")
    args = parser.parse_args()
    with open(args.rects_json, encoding='utf-8') as f:
        rects = json.load(f)
    with open(args.info_json, encoding='utf-8') as f:
        info = json.load(f)
    _run_update(args.input_img, args.output_dir, rects, info)
