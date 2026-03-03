import cv2
import os
import numpy as np
from publib import Path
from typing import Dict, List, Optional, ImageFont
from PIL import Image, ImageDraw


def _get_jpeg_path(image_path: Path):
    if image_path.suffix.lower() in ['.jpeg', '.jpg']:
        return image_path
    # TODO pdf transfer
    return None


def _annotate_matches(
    image_path: Path,
    matches: List[Dict[str, object]],
    output_dir: str,
    *,
    suffix: str = "_annotated_dims",
    outline: str = "red",
    label_prefix: str = "",
    start_index: int = 1,
    box_on: bool = True
) -> Optional[Path]:
    if not matches:
        return None

    # TODO pdf 対応(pdfだったら画像ファイルに変換
    annotated_path = _get_jpeg_path(
        image_path.with_name(
            f"{image_path.stem}{suffix}{image_path.suffix}")
    )
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
            label_text = f"{label_prefix}{idx}" if label_prefix else str(idx)
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

            label_anchor = (label_x, label_y)
            drawer.text(label_anchor, label_text, fill=outline, font=font)
        if not os.path.isdir(output_dir):
            os.makedirs(output_dir)
        output_path = f"{output_dir}{annotated_path.name}"
        img.save(output_path)
        # TODO pdf も保存する

    return output_path


def get_black_and_white_colors(
        img,
        hsv,
        tmp_values=[100, 100, 100]):

    # 黒色の範囲 (低明度)
    lower_black = np.array([0, 0, 0])
    upper_black = np.array([180, 255, 50])  # 明度(V)が低い部分を黒とみなす
    mask_black = cv2.inRange(hsv, lower_black, upper_black)

    # 白色の範囲 (低彩度 & 高明度)
    lower_white = np.array([0, 0, 200])
    upper_white = np.array([180, 50, 255])  # 彩度(S)が低く、明度(V)が高い部分を白とみなす
    mask_white = cv2.inRange(hsv, lower_white, upper_white)

    # 黒と白のマスクを結合
    mask_bw = cv2.bitwise_or(mask_black, mask_white)

    # 黒白以外のマスクを作成（反転）
    mask_color = cv2.bitwise_not(mask_bw)

    # マスクを適用して色部分を抽出
    result = cv2.bitwise_and(img, img, mask=mask_color)

    hs = result.T[0].flatten()
    ss = result.T[1].flatten()
    vs = result.T[2].flatten()
    return (np.array([hs.min(), ss.min(), vs.min()]) + tmp_values,
            np.array([hs.max(), ss.max(), vs.max()]) + tmp_values)


def get_red_area():
    return (
        np.array([130, 130, 160]),
        np.array([179, 255, 255])
    )
