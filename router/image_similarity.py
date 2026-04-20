from fastapi import Request, APIRouter
from fastapi.responses import StreamingResponse
from state.app_status import AppStatus, Status
from app_router import AppRoute
from app_logger import AppLogger
import os
import cv2
import numpy as np
import json
from pathlib import Path
from PIL import Image
from pdf2image import convert_from_path
from io import BytesIO
import zipfile
from datetime import datetime
from test_scripts.test_similarity_image import calc_image_similarity

router = APIRouter(prefix='/api', route_class=AppRoute)


class ImageSimilarity:

    @classmethod
    async def get_image_rect(cls, img_path: str) -> list[list]:

        def get_black_and_white_colors(img, hsv):

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
            tmp_values = np.array([20, 20, 20])
            return (np.array([hs.min(), ss.min(), vs.min()]) + tmp_values,
                    np.array([hs.max(), ss.max(), vs.max()]) + tmp_values)

        def to_box(x, y, w, h):
            return (x, y, x + w, y + h)  # (x1, y1, x2, y2)

        def is_inside(a, b, inclusive=True):
            ax1, ay1, ax2, ay2 = a
            bx1, by1, bx2, by2 = b
            if inclusive:
                return bx1 <= ax1 and by1 <= ay1 and bx2 >= ax2 and by2 >= ay2
            else:
                return bx1 < ax1 and by1 < ay1 and bx2 > ax2 and by2 > ay2

        def sort_left_top(boxes, y_threshold=50):
            """左上から並べる
            1. (0, 0)に一番距離が近い座標を求める(これが1番)
            2. 1以外を上から順に並べる
            3. yが近いものを同じ行としてグループ化
            4. 2でグループ化したものを左から右に並べる
            5. 1つの配列にまとめて返す
            """
            target_box = min(
                boxes, key=lambda b: (b[0]**2 + b[1]**2, b[1], b[0])
            )
            boxes_without_target = [b for b in boxes if b is not target_box]
            
            # まずyでソート
            boxes_without_target = sorted(boxes_without_target, key=lambda b: b[1])
            rows = []

            for box in boxes_without_target:
                placed = False
                for row in rows:
                    # yが近ければ同じ行
                    if abs(row[0][1] - box[1]) <= y_threshold:
                        row.append(box)
                        placed = True
                        break
                if not placed:
                    rows.append([box])
            # 行内をxでソートしてフラット化
            result = []
            for row in rows:
                result.extend(sorted(row, key=lambda b: b[0]))
            result = [target_box] + result
            return result

        image = cv2.imread(img_path)
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        # 黒と白以外色の範囲を取得
        lower_color, upper_color = get_black_and_white_colors(image, hsv)
        upper_color = np.array([275, 254, 275])
        print(f"lower:{lower_color}\n upper:{upper_color}")
        # 指定色のマスク作成
        mask = cv2.inRange(hsv, lower_color, upper_color)

        # ノイズ除去
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)

        # 輪郭抽出
        contours, _ = cv2.findContours(
            mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        print(len(contours))

        if len(contours) == 0:
            print("指定色の四角形が見つかりませんでした。")
            return []
        else:
            print(f"contours size: {len(contours)}")

            # 画像の総面積
            img_height, img_width = image.shape[:2]
            img_total_area = img_width * img_height

            contours_list = []
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > img_total_area * 0.005:
                    contours_list.append(cv2.boundingRect(cnt))

        boxes = [to_box(*r) for r in contours_list]

        # 内側の矩形だけを抽出
        output_rects = []
        for i, a in enumerate(boxes):
            # どれか一つにでも内包されていれば内側とみなす
            if (
                    any(is_inside(a, boxes[j], inclusive=True)
                        and j != i for j in range(len(boxes)))
            ):
                output_rects.append(list(contours_list[i]))
        print(output_rects)
        # 左上からソート
        sorted_rects = sort_left_top(output_rects)
        print(f"output_rects size: {len(sorted_rects)}")
        print(f"座標一覧: {sorted_rects}")

        return sorted_rects

    async def list_to_prefixed_dict(items, prefix="base", start=1):
        return {
            f"{prefix}_{i}": row for i, row in enumerate(items, start=start)
        }

    def cut_images(
        image_path: str,
        rects: dict,
        output_dir: str,
    ) -> list[str]:

        image_path = Path(image_path)
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        with Image.open(image_path) as img:

            saved_paths = []
            for key, (x, y, w, h) in rects.items():
                # 左上・右下座標に変換
                x1 = x
                y1 = y
                x2 = x + w
                y2 = y + h

                crop = img.crop((x1, y1, x2, y2))

                out_path = out_dir / f"{key}.jpg"
                crop.save(out_path)
                saved_paths.append(str(out_path))

            return saved_paths

    def get_similarity(base_image_path, target_image_dir):
        data = calc_image_similarity(base_image_path, target_image_dir)
        return data
    
    def pdf_to_jpeg(file_path):
        """PDFを画像に変換する"""
        file_name = Path(file_path)

        images = convert_from_path(file_name)

        # 各ページを画像として保存する
        files = []
        for i, image in enumerate(images):
            new_file_name = file_name.with_stem(f"{file_name.stem}_{i}")
            save_path = new_file_name.with_suffix(".jpg")
            image.save(save_path, 'JPEG')
            files.append(save_path.as_posix())
        return files
    
    def loop_pdf_to_jpeg(file_dir) -> list:
        pdf_dir = Path(file_dir)
        pdf_files = list(pdf_dir.glob("*.pdf"))
        if len(pdf_files) > 0:
            image_files = [ImageSimilarity.pdf_to_jpeg(file) for file in pdf_files]
            image_files = [x for row in image_files for x in row]
            print(f'save: {image_files}')
            return image_files
        else:
            print("PDFファイルではないようなので、変換せず後続処理を実行")
            return []


@router.post('/image-similarity/')
async def image_similarity(request: Request):
    ret = None
    state = request.state
    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()
    req_status = AppStatus.create_from_state(state)

    req_epic = req_status.epic
    req_ope = req_status.operation
    req_user = req_status.user
    req_opid = req_status.operation_id

    up_base_ope = 'upload-base'
    up_target_ope = 'upload-target'

    upload_base_file_dir = f"./multi-fileupload/{req_user}_{req_epic}"
    upload_base_file_dir += f"_{up_base_ope}_{req_opid}"

    upload_target_file_dir = f"./multi-fileupload/{req_user}_{req_epic}"
    upload_target_file_dir += f"_{up_target_ope}_{req_opid}"

    base_file_list = ImageSimilarity.loop_pdf_to_jpeg(upload_base_file_dir)
    target_file_list = ImageSimilarity.loop_pdf_to_jpeg(upload_target_file_dir)
    is_pdf = False
    if len(base_file_list) > 0 or len(target_file_list) > 0:
        is_pdf = True

    image_extensions = {".jpg", ".jpeg", ".png"}
    base_image_name = [
            p.name for p in Path(upload_base_file_dir).iterdir()
            if p.suffix.lower() in image_extensions][0]
    target_image_name = [
            p.name for p in Path(upload_target_file_dir).iterdir()
            if p.suffix.lower() in image_extensions][0]
    base_image_path = Path(upload_base_file_dir, base_image_name)
    target_image_path = Path(upload_target_file_dir, target_image_name)
    _OUT_BASE_DIR = f'./{req_epic}-responce'
    out_dir = f"{_OUT_BASE_DIR}/{req_user}_{req_epic}_{req_ope}_{req_opid}"

    # TODO operation_idがない場合はエラーにするか？
    match req_status.status:
        case Status.START:
            # TODO 一応想定外だがどうするか？
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "MULTI-FILE-UPLOAD START STATUS ??"
            )
        case Status.DOING:
            # 座標と類似度の計算
            try:
                logger.log(
                    req_status,
                    AppLogger.DEBUG,
                    "IMAGE-SIMILARITY DOING STATUS START"
                )

                is_exist_dir = os.path.exists(upload_base_file_dir)
                is_exist_file = os.path.exists(upload_target_file_dir)

                if is_exist_dir and is_exist_file:
                    # app_status 作成
                    app_state.create_new_app_status(
                        req_status
                    )
                    # 座標の計算
                    get_image_rect_ope = ImageSimilarity.get_image_rect
                    base_rects = await get_image_rect_ope(
                            base_image_path)
                    list_to_dict_ope = ImageSimilarity.list_to_prefixed_dict
                    out_base_rects = await list_to_dict_ope(
                            base_rects, "base")
                    target_rects = await get_image_rect_ope(
                            target_image_path)
                    out_target_rects = await list_to_dict_ope(
                            target_rects, "target")

                    # 座標から切り取り
                    ImageSimilarity.cut_images(
                            base_image_path,
                            out_base_rects,
                            Path(out_dir, "cut_base"))
                    ImageSimilarity.cut_images(
                            target_image_path,
                            out_target_rects,
                            Path(out_dir, "cut_target"))

                    # 類似度計算
                    similarities = {}
                    for p in Path(out_dir, "cut_base").iterdir():
                        data = ImageSimilarity.get_similarity(
                                p,
                                Path(out_dir, "cut_target"))
                        similarities[p.stem] = data
                else:
                    error_msg = "IMAGE-SIMILARITY DIR NOT FOUND:"
                    error_msg += f"{upload_base_file_dir} "
                    error_msg += f"or {upload_target_file_dir}"
                    req_status.status = Status.ERROR
                    logger.log(
                        req_status,
                        AppLogger.ERROR,
                        error_msg
                    )

                ret = AppRoute.create_responce_from_status(
                    req_status
                )
                ret["base_rects"] = out_base_rects
                ret["target_rects"] = out_target_rects
                ret["similarities"] = similarities
                print(ret)

                with open(
                    f"{out_dir}/responce.json", "w", encoding="utf-8"
                ) as f:
                    json.dump(ret, f, indent=2)

            except Exception as e:
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"IMAGE-SIMILARITY DOING STATUS error !:{e}"
                )
                raise e

        case Status.END:
            # TODO 一応想定外だがどうするか？
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "IMAGE-SIMILARITY END STATUS ??"
            )
            if is_pdf:
                io = BytesIO()
                now = datetime.now().strftime('%Y%m%d%H%M%S')
                zip_filename = f"drawing-compare_{now}.zip"
                file_list = base_file_list + target_file_list
                with zipfile.ZipFile(
                        io, mode='w', compression=zipfile.ZIP_DEFLATED) as zip:
                    for fpath in file_list:
                        zip.write(fpath)
                return StreamingResponse(
                    iter([io.getvalue()]),
                    media_type="application/x-zip-compressed",
                    headers={
                    "Content-Disposition": f"attachment;filename={zip_filename}"
                    }
                )


    return ret
