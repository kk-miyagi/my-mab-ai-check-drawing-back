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

    def get_cmd(self, base_cmd, app_state, req_status):
        in_dir = f"{self._IN_BASE_DIR}/{req_status.get_hash_key()}/"
        out_dir = f"{self._OUT_BASE_DIR}/{req_status.get_hash_key()}/"
        f_list = [f for f in os.listdir(in_dir) if f != '.gitkeep']
        img = [f for f in f_list if not f.lower().endswith(".pdf")][0]
        return f"{base_cmd} {in_dir} {img} {out_dir}"


@router.post("/create-label/")
async def create_label(request: Request, background_tasks: BackgroundTasks):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    upload_dir = f"./multi-fileupload/{req_status.get_hash_key()}"

    target_status = req_status.status
    match target_status:
        case Status.START:
            logger.log(req_status, AppLogger.DEBUG, "CREATE-LABEL START STATUS START")
            if os.path.exists(upload_dir):
                pdf_list = [f"{upload_dir}/{f}"
                            for f in os.listdir(upload_dir)
                            if f.lower().endswith(".pdf")]
                app_state.update_app_status(req_status)
                if len(pdf_list) > 0:
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
                            image_files = [pdf_to_jpeg(file) for file in pdf_files]
                            image_files = [x for row in image_files for x in row]
                            return image_files
                        else:
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
                            req_status.status = up_status
                            app_state.update_app_status(
                                req_status
                            )
                            return  AppRoute.create_responce_from_status(
                                req_status
                            )
                    loop_pdf_to_jpeg(upload_dir)

                BackendTasks.set_backend_runner(
                    req_status, CreateLabelRunner(), background_tasks)
            else:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"CREATE-LABEL UPLOAD DIR NOT FOUND:{upload_dir}")
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.DOING:
            logger.log(req_status, AppLogger.DEBUG, "CREATE-LABEL DOING STATUS START")
            app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.END:
            logger.log(req_status, AppLogger.DEBUG, "CREATE-LABEL END STATUS START")
            app_status = app_state.get_eq_app_status(req_status)
            if app_status is None or app_status.status != Status.END:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"CREATE-LABEL REQUEST IS NOT END:{req_status.status}")
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
                return AppRoute.create_responce_from_status(req_status)

            res_dir = f"./create-label-responce/{req_status.get_hash_key()}/"
            fname_list = os.listdir(res_dir)

            image_exts = (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp")
            image_files = [f"{res_dir}/{f}"
                           for f in fname_list if f.lower().endswith(image_exts)]
            for file in image_files:
                file = Path(file)
                new_file_name = Path(file).with_suffix(".pdf")
                with open(new_file_name, "wb") as f:
                    f.write(img2pdf.convert(file))

            extensions = ('.csv', '.jpg', 'pdf')
            file_list = [
                res_dir + fname
                for fname in fname_list if fname.endswith(extensions)
            ]

            io = BytesIO()
            now = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"create-label_{now}.zip"
            with zipfile.ZipFile(io, mode='w', compression=zipfile.ZIP_DEFLATED) as zip:
                for fpath in file_list:
                    zip.write(fpath)
            app_state.update_app_status(req_status)
            return StreamingResponse(
                iter([io.getvalue()]),
                media_type="application/x-zip-compressed",
                headers={"Content-Disposition": f"attachment;filename={zip_filename}"}
            )
