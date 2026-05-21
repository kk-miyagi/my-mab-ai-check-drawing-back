from fastapi import Request, APIRouter
from fastapi.responses import StreamingResponse
from state.app_status import AppStatus
from app_router import AppRoute, Status
from app_logger import AppLogger
from datetime import datetime
from pathlib import Path
from io import BytesIO
import os
import zipfile
import img2pdf
from tools.sort_manga_panels import sort_mange_panels
from typing import List, Dict, Optional
from PIL import Image, ImageDraw, ImageFont
import re

router = APIRouter(prefix='/api', route_class=AppRoute)


# create_label_task.pyの_aotate_matches()と同じ。最終的に1つの共通関数にまとめる想定。
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
        file_name = re.sub(r'\d+_(af|bf)_file_', '', annotated_path.name)
        output_path = Path(f"{output_dir}/{file_name}")
        img.save(output_path)

    return output_path


@router.post("/update-label/")
async def update_label(request: Request):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()
    up_epic = 'create-label'
    in_op = 'batch-create-label'

    req_user = req_status.user
    req_opid = req_status.operation_id

    # ラベル付与していない図面の保存先の指定
    input_dir = f"./multi-fileupload/{req_user}_{up_epic}_{in_op}_{req_opid}"

    # ラベル付与後の図面の保存先の指定
    output_dir = f"./update-label-response/{req_status.get_hash_key()}"

    # ファイルを取得
    f_list = [
        f for f in os.listdir(input_dir)
        if f.lower().endswith((".jpg", ".jpeg"))
    ]
    if len(f_list) == 1:
        input_img = f"{input_dir}/{f_list[0]}"
    else:
        raise Exception(
                f"Input image file not found or multiple files found in {input_dir}")

    target_status = req_status.status
    match target_status:
        case Status.START:
            logger.log(
                req_status,
                AppLogger.INFO,
                "UPDATE-LABEL START STATUS"
            )
            app_state.update_app_status(
                req_status
            )
            return AppRoute.create_responce_from_status(
                req_status
            )
        case Status.DOING:
            # rects: x1, y1, x2, y2
            # info: 項目, 寸法値または品質指定等の記載内容, 備考
            rects_dict = request.state.rects
            info_dict = request.state.info

            rect_list = list(rects_dict.values())
            sorted_rects = sort_mange_panels(rect_list)
            rect_to_key = {tuple(v): k for k, v in rects_dict.items()}
            sorted_old_keys = [
                    rect_to_key[tuple(rect)] for rect in sorted_rects]

            # sort_mange_panels()の結果をもとにキーの振り直し
            rects_dict = {
                i: rects_dict[k]
                for i, k in enumerate(sorted_old_keys, start=1)
            }
            info_dict = {
                i: info_dict[k] for i, k in enumerate(sorted_old_keys, start=1)
            }

            # _annotate_matches()に渡すためのordered_matchesを作成
            ordered_matches = [
                {"id": str(k), "rect": v}
                for k, v in rects_dict.items()
            ]

            # 図面にラベルを描画する処理(ラベル付与と同じ処理)
            box_on = True
            annotated_path = _annotate_matches(
                Path(input_img),
                ordered_matches,
                suffix="_label_result",
                outline=(220, 20, 60),
                output_dir=output_dir,
                box_on=box_on
            )
            print("Annotated image saved at:", annotated_path)

            # PDFへの変換
            new_file_name = Path(annotated_path).with_suffix(".pdf")
            with open(new_file_name, "wb") as f:
                f.write(img2pdf.convert(Path(annotated_path)))
            print("Annotated PDF saved at:", new_file_name)

            # infoはcsv形式で出力する
            csv_path = f"{annotated_path.with_suffix('.csv')}"
            with open(csv_path, "w", encoding="utf-8") as f:
                f.write("No,項目,寸法値または品質指定等の記載内容,備考\n")
                for key, info in info_dict.items():
                    f.write(f"{key},{info[0]},{info[1]},{info[2]}\n")
            print("Info CSV saved at:", csv_path)

            box_on = False
            annotated_path = _annotate_matches(
                Path(input_img),
                ordered_matches,
                suffix="_label_result_no_box",
                outline=(220, 20, 60),
                output_dir=output_dir,
                box_on=box_on
            )
            print("Annotated image saved at:", annotated_path)

            # PDFへの変換
            new_file_name = Path(annotated_path).with_suffix(".pdf")
            with open(new_file_name, "wb") as f:
                f.write(img2pdf.convert(Path(annotated_path)))
            print("Annotated PDF saved at:", new_file_name)

            app_state.update_app_status(
                req_status
            )
            return AppRoute.create_responce_from_status(
                req_status
            )

        case Status.END:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "UPDATE-LABEL END STATUS START"
            )
            # ダウンロード先ディレクトリから図面ファイル、CSVファイル読み込み
            fname_list = os.listdir(output_dir)
            extensions = ('.csv', '.pdf')
            file_list = [
                Path(output_dir) / fname
                for fname in fname_list if fname.endswith(extensions)
            ]

            # ZIPに固めてダウンロードの返信を実施
            io = BytesIO()
            now = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"update-label_{now}.zip"
            with zipfile.ZipFile(
                    io, mode='w', compression=zipfile.ZIP_DEFLATED) as zip:
                for fpath in file_list:
                    zip.write(fpath)
            app_state.update_app_status(
                req_status
            )
            return StreamingResponse(
                iter([io.getvalue()]),
                media_type="application/x-zip-compressed",
                headers={
                   "Content-Disposition": f"attachment;filename={zip_filename}"
                }
            )

