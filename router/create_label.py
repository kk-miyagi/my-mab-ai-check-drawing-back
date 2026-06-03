from fastapi import Request, APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse
from state.app_status import AppStatus
from app_router import AppRoute, Status
from app_logger import AppLogger
from app_backend_task import BackendTasks, BackendTaskRunner
from datetime import datetime
from io import BytesIO
from pdf2image import convert_from_path
import img2pdf
from pathlib import Path
import os
import zipfile
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tools.is_single_page_pdf import is_single_page_pdf

router = APIRouter(prefix='/api', route_class=AppRoute)


class CreateLabelRunner(BackendTaskRunner):

    _IN_BASE_DIR = './multi-fileupload'
    _OUT_BASE_DIR = './create-label-responce'
    _EPIC = 'create-label'
    _IN_OPE = 'batch-create-label'
    _OUT_OPE = 'batch-create-label'
    _FILE_KEY = 'bf_file'

    def get_cmd(self, base_cmd, app_state, req_status):
        req = req_status
        in_dir = f"{self._IN_BASE_DIR}/"
        in_dir += f"{req.user}_{self._EPIC}_{req.group_id}"
        in_dir += f"_{self._IN_OPE}_{req.operations[0].operation_id}/"
        out_dir = f"{self._OUT_BASE_DIR}/"
        out_dir += f"{req.user}_{self._EPIC}"
        out_dir += f"_{req.group_id}"
        out_dir += f"_{self._OUT_OPE}_{req.operations[0].operation_id}/"
        f_list = [f for f in os.listdir(in_dir) if f != '.gitkeep']
        img = None
        # TODO: 複数図面の実装次第で修正
        img = [f for f in f_list if not f.lower().endswith(".pdf")][0]

        return f"{base_cmd} {in_dir} {img} {out_dir}"


@router.post("/create-label/")
async def create_label(request: Request, background_tasks: BackgroundTasks):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()
    up_epic = 'create-label'
    up_ope = 'batch-create-label'

    req_user = req_status.user
    req_grid = req_status.group_id
    req_opid = req_status.operations[0].operation_id
    upload_dir = f"./multi-fileupload/{req_user}_{up_epic}_{req_grid}"
    upload_dir += f"_{up_ope}_{req_opid}"

    target_status = req_status.operations[0].status
    match target_status:
        case Status.START:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "CREATE-LABEL START STATUS START"
            )
            if os.path.exists(upload_dir):
                pdf_list = [f"{upload_dir}/{f}"
                            for f in os.listdir(upload_dir)
                            if f.lower().endswith(".pdf")]
                app_state.update_app_status(
                    req_status
                )
                if len(pdf_list) > 0:
                    def pdf_to_jpeg(file_path):
                        """PDFを画像に変換する"""
                        file_name = Path(file_path)

                        images = convert_from_path(file_name)

                        # 各ページを画像として保存する
                        files = []
                        for i, image in enumerate(images):
                            new_file_name = file_name.with_stem(
                                    f"{file_name.stem}")
                            save_path = new_file_name.with_suffix(".jpg")
                            image.save(save_path, 'JPEG')
                            files.append(save_path.as_posix())
                        return files

                    def loop_pdf_to_jpeg(file_dir) -> list:
                        pdf_dir = Path(file_dir)
                        pdf_files = list(pdf_dir.glob("*.pdf"))
                        if len(pdf_files) > 0:
                            image_files = [
                                    pdf_to_jpeg(file) for file in pdf_files]
                            image_files = [
                                    x for row in image_files for x in row]
                            return image_files
                        else:
                            # TODO to log file
                            print("PDFファイルではないようなので、変換せず後続処理を実行")
                            return []

                    for file in list(Path(upload_dir).glob("*.pdf")):
                        if not is_single_page_pdf(file):
                            up_status = Status.ERROR
                            logger.log(
                                req_status,
                                AppLogger.DEBUG,
                                f"PDF file {file} is not a single page."
                            )
                            req_status.group_status = up_status
                            req_status.operations[0].status = up_status
                            app_state.update_app_status(
                                req_status
                            )
                            return  AppRoute.create_responce_from_status(
                                req_status
                            )
                    loop_pdf_to_jpeg(upload_dir)

                # 別プロセスにてラベル付与実行
                BackendTasks.set_backend_runner(
                    req_status,
                    CreateLabelRunner(),
                    background_tasks
                )
            else:
                up_status = Status.ERROR
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"CREATE-LABEL UPLOAD DIR NOT FOUND:{upload_dir}"
                )
                req_status.group_status = up_status
                req_status.operations[0].status = up_status
                app_state.update_app_status(
                    req_status
                )
            return AppRoute.create_responce_from_status(
                req_status
            )
        case Status.DOING:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "CREATE-LABEL DOING STATUS START"
            )
            app_state.update_app_status(
                req_status
            )
            # requestと同じステータス
            return AppRoute.create_responce_from_status(
                req_status
            )
        case Status.END:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "CREATE-LABEL END STATUS START"
            )
            # 1)status END確認
            app_status = app_state.get_eq_app_status(req_status)
            if app_status is None or app_status.group_status != Status.END:
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"CREATE-LABEL REQUEST IS NOT END:{req_status.group_status}"
                )
                up_status = Status.ERROR
                req_status.group_staus = up_status
                req_status.operations[0].status = up_status
                app_state.update_app_status(
                    req_status
                )
                return AppRoute.create_responce_from_status(
                    req_status
                )
            # 2)ダウンロード先ディレクトリから図面ファイル、CSVファイル読み込み
            ope_dir = f"{req_status.user}_{req_status.epic}_"
            ope_dir += f"{req_status.group_id}"
            ope_dir += f"_{req_status.operations[0].operation}"
            ope_dir += f"_{req_status.operations[0].operation_id}/"
            res_dir = f"./create-label-responce/{ope_dir}"
            fname_list = os.listdir(res_dir)

            # pdfに変換
            image_exts = (
                    ".jpg",
                    ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp")
            image_files = [
                    f"{res_dir}/{f}"
                    for f in fname_list if f.lower().endswith(image_exts)]
            for file in image_files:
                file = Path(file)
                new_file_name = Path(file).with_suffix(".pdf")
                with open(new_file_name, "wb") as f:
                    f.write(img2pdf.convert(file))

            # pdfファイルとcsvファイルとjpgファイルだけzipにまとめる
            extensions = ('.csv', '.jpg', 'pdf')
            file_list = [
                res_dir + fname
                for fname in fname_list if fname.endswith(extensions)
            ]
            # TODO File name kara 1_bf_fileを除く
            # TODO CSVの最後の列を除く

            # 3)ZIPに固めてダウンロードの返信を実施
            io = BytesIO()
            now = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"create-label_{now}.zip"
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
