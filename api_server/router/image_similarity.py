from fastapi import Request, APIRouter
from fastapi.responses import StreamingResponse
from common.state.app_status import AppStatus, Status
from api_server.app_router import AppRoute
from common.logger import AppLogger
import os

DATA_ROOT = os.environ.get('DATA_ROOT', '.')
import cv2
import numpy as np
import json
from pathlib import Path
from PIL import Image
from pdf2image import convert_from_path
from io import BytesIO
import zipfile
from datetime import datetime
from api_server.lib.image_similarity_utils import calc_image_similarity
from common.tools.sort_manga_panels import sort_mange_panels

router = APIRouter(prefix='/api', route_class=AppRoute)


class ImageSimilarity:

    @classmethod
    async def get_image_rect(cls, img_path: str) -> list[list]:

        def get_black_and_white_colors(img, hsv):
            lower_black = np.array([0, 0, 0])
            upper_black = np.array([180, 255, 50])
            mask_black = cv2.inRange(hsv, lower_black, upper_black)
            lower_white = np.array([0, 0, 200])
            upper_white = np.array([180, 50, 255])
            mask_white = cv2.inRange(hsv, lower_white, upper_white)
            mask_bw = cv2.bitwise_or(mask_black, mask_white)
            mask_color = cv2.bitwise_not(mask_bw)
            result = cv2.bitwise_and(img, img, mask=mask_color)
            hs = result.T[0].flatten()
            ss = result.T[1].flatten()
            vs = result.T[2].flatten()
            tmp_values = np.array([20, 20, 20])
            return (np.array([hs.min(), ss.min(), vs.min()]) + tmp_values,
                    np.array([hs.max(), ss.max(), vs.max()]) + tmp_values)

        def to_box(x, y, w, h):
            return (x, y, x + w, y + h)

        def is_inside(a, b, inclusive=True):
            ax1, ay1, ax2, ay2 = a
            bx1, by1, bx2, by2 = b
            if inclusive:
                return bx1 <= ax1 and by1 <= ay1 and bx2 >= ax2 and by2 >= ay2
            else:
                return bx1 < ax1 and by1 < ay1 and bx2 > ax2 and by2 > ay2

        image = cv2.imread(img_path)
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        lower_color, upper_color = get_black_and_white_colors(image, hsv)
        upper_color = np.array([275, 254, 275])
        mask = cv2.inRange(hsv, lower_color, upper_color)
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        if len(contours) == 0:
            return []

        img_height, img_width = image.shape[:2]
        img_total_area = img_width * img_height
        contours_list = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > img_total_area * 0.005:
                contours_list.append(cv2.boundingRect(cnt))

        boxes = [to_box(*r) for r in contours_list]
        output_rects = []
        for i, a in enumerate(boxes):
            if any(is_inside(a, boxes[j], inclusive=True) and j != i for j in range(len(boxes))):
                output_rects.append(list(contours_list[i]))
        sorted_rects = sort_mange_panels(output_rects)
        return sorted_rects

    async def list_to_prefixed_dict(items, prefix="base", start=1):
        return {f"{prefix}_{i}": row for i, row in enumerate(items, start=start)}

    def cut_images(image_path: str, rects: dict, output_dir: str) -> list[str]:
        image_path = Path(image_path)
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        with Image.open(image_path) as img:
            saved_paths = []
            for key, (x, y, w, h) in rects.items():
                crop = img.crop((x, y, x + w, y + h))
                out_path = out_dir / f"{key}.jpg"
                crop.save(out_path)
                saved_paths.append(str(out_path))
            return saved_paths

    def get_similarity(base_image_path, target_image_dir):
        return calc_image_similarity(base_image_path, target_image_dir)

    def pdf_to_jpeg(file_path):
        file_name = Path(file_path)
        images = convert_from_path(file_name)
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
            return image_files
        else:
            return []


@router.post('/image-similarity/')
async def image_similarity(request: Request):
    ret = None
    state = request.state
    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()
    req_status = AppStatus.create_from_state(state)

    req_epic = req_status.epic
    req_user = req_status.user
    req_opid = req_status.operation_id

    up_base_ope = 'upload-base'
    up_target_ope = 'upload-target'

    upload_base_file_dir = f"{DATA_ROOT}/multi-fileupload/{req_user}_{req_epic}_{up_base_ope}_{req_opid}"
    upload_target_file_dir = f"{DATA_ROOT}/multi-fileupload/{req_user}_{req_epic}_{up_target_ope}_{req_opid}"

    base_file_list = ImageSimilarity.loop_pdf_to_jpeg(upload_base_file_dir)
    target_file_list = ImageSimilarity.loop_pdf_to_jpeg(upload_target_file_dir)
    is_pdf = len(base_file_list) > 0 or len(target_file_list) > 0

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
    out_dir = f"{_OUT_BASE_DIR}/{req_status.get_hash_key()}"

    target_status = req_status.status
    match target_status:
        case Status.START:
            logger.log(req_status, AppLogger.DEBUG, "IMAGE-SIMILARITY START STATUS ??")

        case Status.DOING:
            try:
                logger.log(req_status, AppLogger.DEBUG, "IMAGE-SIMILARITY DOING STATUS START")
                app_state.update_app_status(req_status)
                is_exist_dir = os.path.exists(upload_base_file_dir)
                is_exist_file = os.path.exists(upload_target_file_dir)

                out_base_rects = {}
                out_target_rects = {}
                similarities = {}

                if is_exist_dir and is_exist_file:
                    app_state.create_new_app_status(req_status)
                    get_image_rect_ope = ImageSimilarity.get_image_rect
                    base_rects = await get_image_rect_ope(base_image_path)
                    list_to_dict_ope = ImageSimilarity.list_to_prefixed_dict
                    out_base_rects = await list_to_dict_ope(base_rects, "base")
                    target_rects = await get_image_rect_ope(target_image_path)
                    out_target_rects = await list_to_dict_ope(target_rects, "target")

                    ImageSimilarity.cut_images(base_image_path, out_base_rects, Path(out_dir, "cut_base"))
                    ImageSimilarity.cut_images(target_image_path, out_target_rects, Path(out_dir, "cut_target"))

                    for p in Path(out_dir, "cut_base").iterdir():
                        similarities[p.stem] = ImageSimilarity.get_similarity(p, Path(out_dir, "cut_target"))
                else:
                    logger.log(
                        req_status, AppLogger.ERROR,
                        f"IMAGE-SIMILARITY DIR NOT FOUND:{upload_base_file_dir}")
                    req_status.status = Status.ERROR
                    app_state.update_app_status(req_status)

                ret = AppRoute.create_responce_from_status(req_status)
                ret["base_rects"] = out_base_rects
                ret["target_rects"] = out_target_rects
                ret["similarities"] = similarities

                with open(f"{out_dir}/responce.json", "w", encoding="utf-8") as f:
                    json.dump(ret, f, indent=2)

            except Exception as e:
                logger.log(req_status, AppLogger.ERROR, f"IMAGE-SIMILARITY DOING STATUS error !:{e}")
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
                raise e

        case Status.END:
            logger.log(req_status, AppLogger.DEBUG, "IMAGE-SIMILARITY END STATUS ??")
            if is_pdf:
                io = BytesIO()
                now = datetime.now().strftime('%Y%m%d%H%M%S')
                zip_filename = f"drawing-compare_{now}.zip"
                file_list = base_file_list + target_file_list
                with zipfile.ZipFile(io, mode='w', compression=zipfile.ZIP_DEFLATED) as zip:
                    for fpath in file_list:
                        zip.write(fpath)
                return StreamingResponse(
                    iter([io.getvalue()]),
                    media_type="application/x-zip-compressed",
                    headers={"Content-Disposition": f"attachment;filename={zip_filename}"}
                )
    return ret
