from fastapi import Request, APIRouter
from fastapi.responses import StreamingResponse
from state.app_status import AppStatus, Status
from app_router import AppRoute
from app_logger import AppLogger
import os
import cv2 as cv
import numpy as np
from pathlib import Path
from PIL import Image
from io import BytesIO
import zipfile
from datetime import datetime


router = APIRouter(prefix='/api', route_class=AppRoute)


class DrawingHighlight:

    @classmethod
    # 画像の差分を検出し、差分領域の黒字部分を赤くして保存する関数
    def highlight_diff(cls, img1_filename, img2_filename):
        print("ハイライト開始")
        # 画像ファイルの読み込み（JPEG形式）
        img1 = cv.imread(img1_filename)
        img2 = cv.imread(img2_filename)
        # サイズを揃える
    #   img1, img2 = pad_to_same_size(img1, img2)
        img1 = cv.resize(img1, (img2.shape[1], img2.shape[0]))
        # グレースケール変換
        gray1 = cv.cvtColor(img1, cv.COLOR_BGR2GRAY)
        gray2 = cv.cvtColor(img2, cv.COLOR_BGR2GRAY)

        # 差分画像の作成
        diff = cv.absdiff(gray1, gray2)
        # 差分画像を2値化
        _, diff_bin = cv.threshold(diff, 30, 255, cv.THRESH_BINARY)

        # 差分領域の輪郭を抽出
        contours, _ = cv.findContours(
                diff_bin, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

        # 元画像をコピーして差分領域の黒字部分を赤く塗る
        img1_marked = img1.copy()
        img2_marked = img2.copy()
        for cnt in contours:
            area = cv.contourArea(cnt)
            if area < 50:  # ノイズ除去（小さい領域は無視）
                continue
            x, y, w, h = cv.boundingRect(cnt)
            # 差分領域のマスク作成
            mask = np.zeros(gray1.shape, dtype=np.uint8)
            cv.drawContours(mask, [cnt], -1, 255, -1)
            mask_roi = mask[y:y+h, x:x+w]
            # ROIを抽出
            roi1 = img1_marked[y:y+h, x:x+w]
            roi2 = img2_marked[y:y+h, x:x+w]
            # 黒字部分（暗い画素）を赤に（閾値80は調整可）
            black_pixels1 = (
                    cv.cvtColor(roi1, cv.COLOR_BGR2GRAY) < 80) & (mask_roi == 255)
            black_pixels2 = (
                    cv.cvtColor(roi2, cv.COLOR_BGR2GRAY) < 80) & (mask_roi == 255)
            roi1[black_pixels1] = [0, 0, 255]
            roi2[black_pixels2] = [0, 0, 255]
            img1_marked[y:y+h, x:x+w] = roi1
            img2_marked[y:y+h, x:x+w] = roi2

        print("ハイライト終了")

        return img1_marked, img2_marked

    @classmethod
    async def highlight(cls, before_img, after_img, out_dir):
        img_1 = cv.imread(before_img)
        img_2 = cv.imread(after_img)

        area_1 = img_1.shape[0] * img_1.shape[1]
        area_2 = img_2.shape[0] * img_2.shape[1]

        if area_1 >= area_2:
            img_1 = cv.resize(img_1, (img_2.shape[1], img_2.shape[0]))
        else:
            img_2 = cv.resize(img_2, (img_1.shape[1], img_1.shape[0]))

        gray_1 = cv.cvtColor(img_1, cv.COLOR_BGR2GRAY).astype(np.float32)
        gray_2 = cv.cvtColor(img_2, cv.COLOR_BGR2GRAY).astype(np.float32)

        (x, y), r = cv.phaseCorrelate(gray_1, gray_2)
        print(f"({x}, {y}), {r}")

        h_1, w_1 = gray_1.shape[:2]

        if x < 0:
            x11, x12 = abs(int(x)), w_1
            x21, x22 = 0, w_1 - abs(int(x))
        else:
            x21, x22 = abs(int(x)), w_1
            x11, x12 = 0, w_1 - abs(int(x))

        if y < 0:
            y11, y12 = abs(int(y)), h_1
            y21, y22 = 0, h_1 - abs(int(y))
        else:
            y21, y22 = abs(int(y)), h_1
            y11, y12 = 0, h_1 - abs(int(y))

        img_1_moved = cv.convertScaleAbs(gray_1[y11:y12, x11:x12])
        img_2_moved = cv.convertScaleAbs(gray_2[y21:y22, x21:x22])

        before_file_name = Path(before_img).stem
        after_file_name = Path(after_img).stem
        cv.imwrite(
                f"{out_dir}/{before_file_name}_move_check_1_after.jpeg",
                img_1_moved)
        cv.imwrite(
                f"{out_dir}/{after_file_name}_move_check_2_after.jpeg",
                img_2_moved)

        img_1_hl, img_2_hl = DrawingHighlight.highlight_diff(
                f"{out_dir}/{before_file_name}_move_check_1_after.jpeg",
                f"{out_dir}/{after_file_name}_move_check_2_after.jpeg",
        )
        cv.imwrite(
                f"{out_dir}/{before_file_name}_highlight.jpeg",
                img_1_hl)
        cv.imwrite(
                f"{out_dir}/{after_file_name}_hightlight.jpeg",
                img_2_hl)


@router.post('/drawing-highlight/')
async def drawing_highlight(request: Request):
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
    Path(out_dir).mkdir(parents=True, exist_ok=True)

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
            # 差分ハイライト
            try:
                logger.log(
                    req_status,
                    AppLogger.DEBUG,
                    "IMAGE-SIMILARITY DOING STATUS START"
                )

                is_exist_base_dir = os.path.exists(upload_base_file_dir)
                is_exist_target_dir = os.path.exists(upload_target_file_dir)

                if is_exist_base_dir and is_exist_target_dir:
                    # app_status 作成
                    app_state.create_new_app_status(
                        req_status
                    )
                    # ハイライト
                    print(f"base_image_path: {base_image_path}")
                    print(f"target_image_path: {target_image_path}")
                    print(f"out_dir: {out_dir}")
                    await DrawingHighlight.highlight(
                        base_image_path.as_posix(),
                        target_image_path.as_posix(),
                        out_dir
                    )
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

                # 2)ダウンロード先ディレクトリからCSVファイル読み込み

                fname_list = os.listdir(out_dir)
                file_list = [
                    out_dir + fname for fname in fname_list if fname.endswith('.jpg')
                ]
                # 3)ZIPに固めてダウンロードの返信を実施
                io = BytesIO()
                now = datetime.now().strftime('%Y%m%d%H%M%S')
                zip_filename = f"drawing-highlight_{now}.zip"
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
