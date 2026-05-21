from fastapi import Request, APIRouter
from fastapi.responses import StreamingResponse
from state.app_status import AppStatus, Status
from app_router import AppRoute
from app_logger import AppLogger
import os
import cv2 as cv
import numpy as np
from pathlib import Path
from io import BytesIO
import zipfile
from datetime import datetime
import json
import shutil
import img2pdf


router = APIRouter(prefix='/api', route_class=AppRoute)


class DrawingHighlight:

    @classmethod
    # 画像の差分を検出し、差分領域の黒字部分を赤くして保存する関数
    def highlight_diff(cls, img1_filename, img2_filename):
        print("ハイライト開始")
        # 画像ファイルの読み込み（JPEG形式）
        img1 = cv.imread(img1_filename)
        img2 = cv.imread(img2_filename)

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
                    cv.cvtColor(
                        roi1, cv.COLOR_BGR2GRAY) < 80) & (mask_roi == 255)
            black_pixels2 = (
                    cv.cvtColor(
                        roi2, cv.COLOR_BGR2GRAY) < 80) & (mask_roi == 255)
            roi1[black_pixels1] = [0, 0, 255]
            roi2[black_pixels2] = [0, 0, 255]
            img1_marked[y:y+h, x:x+w] = roi1
            img2_marked[y:y+h, x:x+w] = roi2

            img1_yellow = img1_marked.copy()
            img2_yellow = img2_marked.copy()
            alpha = 0.7
            cv.rectangle(img1_yellow, (x, y), (x+w, y+h), (0, 255, 255), -1)
            cv.rectangle(img2_yellow, (x, y), (x+w, y+h), (0, 255, 255), -1)

            cv.addWeighted(
                    img1_marked, alpha, img1_yellow, 1-alpha, 0, img1_marked)
            cv.addWeighted(
                    img2_marked, alpha, img2_yellow, 1-alpha, 0, img2_marked)

        print("ハイライト終了")

        return img1_marked, img2_marked

    @classmethod
    def highlight(cls, before_img, after_img, out_dir):
        img_1 = cv.imread(before_img)
        img_2 = cv.imread(after_img)

        img_1_h, img_1_w = img_1.shape[:2]
        img_2_h, img_2_w = img_2.shape[:2]
        print(f"img_1 shape({img_1_w}, {img_1_h})")
        print(f"img_2 shape({img_2_w}, {img_2_h})")

        min_h = min(img_1_h, img_2_h)
        min_w = min(img_1_w, img_2_w)

        img_r_1 = img_1[0:min_h, 0:min_w]
        img_r_2 = img_2[0:min_h, 0:min_w]

        gray_1 = cv.cvtColor(img_r_1, cv.COLOR_BGR2GRAY).astype(np.float32)
        gray_2 = cv.cvtColor(img_r_2, cv.COLOR_BGR2GRAY).astype(np.float32)

        (x, y), r = cv.phaseCorrelate(gray_1, gray_2)

        if abs(x) < 1:
            x = 0
        if abs(y) < 1:
            y = 0

        print(f"({x}, {y}), {r}")

        h_1, w_1 = gray_1.shape[:2]
        h_2, w_2 = gray_2.shape[:2]

        M = np.float32([[1, 0, -x], [0, 1, -y]])
        img_1_moved = gray_1
        img_2_moved = cv.warpAffine(
            gray_2,
            M,
            (w_2, h_2),
            borderMode=cv.BORDER_CONSTANT,
            borderValue=(255, )
        )

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
        hl_1_h, hl_1_w = img_1_hl.shape[:2]
        hl_2_h, hl_2_w = img_2_hl.shape[:2]

        print(f"hl img_1 shape({hl_1_w}, {hl_1_h})")
        print(f"hl img_2 shape({hl_2_w}, {hl_2_h})")
        re_M = np.float32([[1, 0, x], [0, 1, y]])

        img_1_re_moved = cv.copyMakeBorder(
                img_1_hl,
                0,
                abs(hl_1_h - img_1_h),
                0,
                abs(hl_1_w - img_1_w),
                cv.BORDER_CONSTANT,
                value=[255, 255, 255]
        )
        img_2_af_moved = cv.warpAffine(
            img_2_hl,
            re_M,
            (hl_2_w, hl_2_h),
            borderMode=cv.BORDER_CONSTANT,
            borderValue=(255, 255, 255))
        img_2_re_moved = cv.copyMakeBorder(
                img_2_af_moved,
                abs(img_2_h - img_2_af_moved.shape[0]),
                0,
                0,
                abs(img_2_w - img_2_af_moved.shape[1]),
                cv.BORDER_CONSTANT,
                value=[255, 255, 255]
        )
        img_1_re_h, img_1_re_w = img_1_re_moved.shape[:2]
        img_2_re_h, img_2_re_w = img_2_re_moved.shape[:2]
        print(f"re moved img1 hl shape({img_1_re_w}, {img_1_re_h})")
        print(f"re moved img2 hl shape({img_2_re_w}, {img_2_re_h})")

        cv.imwrite(
                f"{out_dir}/{before_file_name}_highlight.jpeg",
                img_1_re_moved)
        cv.imwrite(
                f"{out_dir}/{after_file_name}_highlight.jpeg",
                img_2_re_moved)

    @classmethod
    def paste_simple(cls, dst_bgr, patch_bgr, x, y, alpha=1.0):
        """
        とてもシンプルな貼り付け（はみ出し考慮なし）
        """
        ph, pw = patch_bgr.shape[:2]

        # 貼り付け先ROI
        dst_roi = dst_bgr[y:y+ph, x:x+pw]

        # アルファブレンド
        blended = cv.addWeighted(patch_bgr, alpha, dst_roi, 1 - alpha, 0)

        # 貼り戻し
        dst_bgr[y:y+ph, x:x+pw] = blended
        return dst_bgr

    @classmethod
    async def paste_cut_image(cls, kind, img_path, out_dir, rects_json):
        print(f"貼り付け開始: {kind}, {img_path}")
        # 最初に元画像をコピーする
        save_img = f'{out_dir}/{kind}_output_img.jpg'
        shutil.copy(img_path, save_img)

        with open(rects_json, 'r') as f:
            res = json.load(f)
            for key, rect in res[f'{kind}_rects'].items():
                # 元の画像
                img = cv.imread(save_img)

                # 切った画像
                x, y, _, _ = rect[0], rect[1], rect[2], rect[3]
                cut_img_path = f'{out_dir}/{key}_highlight.jpeg'
                cut_img = cv.imread(cut_img_path)

                # 貼り付け
                out = DrawingHighlight.paste_simple(
                        img.copy(), cut_img.copy(), x, y)
                cv.imwrite(save_img, out)
                print(f"貼り付け先: {save_img}")
                print(f"切った画像: {cut_img_path}")
        print(f"貼り付け終了: {kind}")

    @classmethod
    async def loop_highlight(
            cls, combinations: dict, base_cut_dir, target_cut_dir, out_dir):
        for base, targets in combinations.items():
            # targetごとに処理
            for target in targets:
                target_path = f"{target_cut_dir}/{target}.jpg"
                DrawingHighlight.highlight(
                        f"{base_cut_dir}/{base}.jpg",
                        target_path,
                        out_dir
                    )


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

    req_combinations = state.combinations
    req_combinations = json.loads(req_combinations)

    up_base_ope = 'upload-base'
    up_target_ope = 'upload-target'

    upload_base_file_dir = f"./multi-fileupload/{req_user}_{req_epic}_{up_base_ope}_{req_opid}"
    upload_target_file_dir = f"./multi-fileupload/{req_user}_{req_epic}_{up_target_ope}_{req_opid}"

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
    Path(out_dir).mkdir(parents=True, exist_ok=True)

    target_status = req_status.status
    match target_status:
        case Status.START:
            # TODO 一応想定外だがどうするか？
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DRAWING-HIGHLIGHT START STATUS ??"
            )
        case Status.DOING:
            # 差分ハイライト
            try:
                logger.log(
                    req_status,
                    AppLogger.DEBUG,
                    "DRAWING-HIGHLIGHT DOING STATUS START"
                )

                is_exist_base_dir = os.path.exists(upload_base_file_dir)
                is_exist_target_dir = os.path.exists(upload_target_file_dir)

                if not (is_exist_base_dir and is_exist_target_dir):
                    error_msg = "DRAWING-HIGHLIGHT DIR NOT FOUND:"
                    error_msg += f"{upload_base_file_dir} "
                    error_msg += f"or {upload_target_file_dir}"
                    req_status.status = Status.ERROR
                    logger.log(req_status, AppLogger.ERROR, error_msg)
                    app_state.update_app_status(req_status)

                if not req_combinations:
                    DrawingHighlight.highlight(
                        base_image_path.as_posix(),
                        target_image_path.as_posix(),
                        out_dir
                    )
                    shutil.copy(
                        f"{out_dir}/{base_image_path.stem}_highlight.jpeg",
                        f"{out_dir}/base_output_img.jpg"
                    )
                    shutil.copy(
                        f"{out_dir}/{target_image_path.stem}_highlight.jpeg",
                        f"{out_dir}/target_output_img.jpg"
                    )

                if req_combinations:
                    sim_dir = f"{_OUT_BASE_DIR}/{req_user}_{req_epic}_image-similarity_{req_opid}"
                    await DrawingHighlight.loop_highlight(
                        req_combinations,
                        f"{sim_dir}/cut_base",
                        f"{sim_dir}/cut_target",
                        out_dir
                    )
                    await DrawingHighlight.paste_cut_image(
                        'base', base_image_path.as_posix(), out_dir,
                        f"{sim_dir}/responce.json"
                    )
                    await DrawingHighlight.paste_cut_image(
                        'target', target_image_path.as_posix(), out_dir,
                        f"{sim_dir}/responce.json"
                    )

                logger.log(
                    req_status,
                    AppLogger.DEBUG,
                    "DRAWING-HIGHLIGHT SAVE OUTPUT IMAGE!"
                )

                # pdf変換
                image_files = [
                    f"{out_dir}/target_output_img.jpg",
                    f"{out_dir}/base_output_img.jpg"
                ]
                for file in image_files:
                    file = Path(file)
                    new_file_name = Path(file).with_suffix(".pdf")
                    with open(new_file_name, "wb") as f:
                        f.write(img2pdf.convert(file))

                # 2)ダウンロード先ディレクトリからCSVファイル読み込み

                fname_list = os.listdir(out_dir)
                file_list = [
                    f"{out_dir}/{fname}" for fname in fname_list
                    if fname.endswith('.pdf')
                ]
                print(f"file_list: {file_list}")
                # 3)ZIPに固めてダウンロードの返信を実施
                io = BytesIO()
                now = datetime.now().strftime('%Y%m%d%H%M%S')
                zip_filename = f"drawing-highlight_{now}.zip"
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

            except Exception as e:
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"DRAWING-HIGHLIGHT DOING STATUS error !:{e}"
                )
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
                raise e

        case Status.END:
            # TODO 一応想定外だがどうするか？
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DRAWING-HIGHLIGHT END STATUS ??"
            )

    return ret
