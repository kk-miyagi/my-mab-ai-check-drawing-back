from fastapi import Request, APIRouter
from state.app_status import AppStatus, Status
from app_router import AppRoute
from app_logger import AppLogger
import os
import time
import cv2
import numpy as np
import sys
from pathlib import Path
from PIL import Image
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
            if any(is_inside(a, boxes[j], inclusive=True) and j != i for j in range(len(boxes))):
                output_rects.append(list(contours_list[i]))

        print(f"output_rects size: {len(output_rects)}")
        print(f"座標一覧: {output_rects}")

        return output_rects

    async def list_to_prefixed_dict(items, prefix="base", start=1):
        return {f"{prefix}_{i}": row for i, row in enumerate(items, start=start)}
    

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

    upload_base_file_dir = f"./multi-fileupload/{req_user}_{req_epic}_{up_base_ope}_{req_opid}"
    upload_target_file_dir = f"./multi-fileupload/{req_user}_{req_epic}_{up_target_ope}_{req_opid}"

    image_extensions = {".jpg", ".jpeg", ".png"}
    base_image_name = [p.name for p in Path(upload_base_file_dir).iterdir() if p.suffix.lower() in image_extensions][0]
    target_image_name = [p.name for p in Path(upload_target_file_dir).iterdir() if p.suffix.lower() in image_extensions][0]
    base_image_path = Path(upload_base_file_dir, base_image_name)
    target_image_path = Path(upload_target_file_dir, target_image_name)
    _OUT_BASE_DIR = './drawing-compare-responce'
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

                if os.path.exists(upload_base_file_dir) and os.path.exists(upload_target_file_dir):
                    # app_status 作成
                    app_state.create_new_app_status(
                        req_status
                    )
                    # 座標の計算
                    base_rects = await ImageSimilarity.get_image_rect(base_image_path)
                    out_base_rects= await ImageSimilarity.list_to_prefixed_dict(base_rects, "base")
                    target_rects = await ImageSimilarity.get_image_rect(target_image_path)
                    out_target_rects = await ImageSimilarity.list_to_prefixed_dict(target_rects, "target")

                    # 座標から切り取り
                    ImageSimilarity.cut_images(base_image_path, out_base_rects, Path(out_dir, "cut_base"))
                    ImageSimilarity.cut_images(target_image_path, out_target_rects, Path(out_dir, "cut_target"))

                    # 類似度計算
                    similarities = {}
                    for p in Path(out_dir, "cut_base").iterdir():
                        data = ImageSimilarity.get_similarity(p, Path(out_dir, "cut_target"))
                        similarities[p.stem] = data
                else:
                    req_status.status = Status.ERROR
                    logger.log(
                        req_status,
                        AppLogger.ERROR,
                        f"IMAGE-SIMILARITY DIR NOT FOUND:{upload_base_file_dir} or {upload_target_file_dir}"
                    )


                ret = AppRoute.create_responce_from_status(
                    req_status
                )
                ret["base_rects"] = out_base_rects
                ret["target_rects"] = out_target_rects
                ret["similarities"] = similarities
                print(ret)

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

    return ret
