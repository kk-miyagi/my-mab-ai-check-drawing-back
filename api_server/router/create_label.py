import os
import zipfile
from datetime import datetime
from io import BytesIO
from pathlib import Path

import img2pdf
from fastapi import Request, APIRouter
from fastapi.responses import StreamingResponse
from pdf2image import convert_from_path

from api_server.app_backend_task import BackendTasks, BackendTaskRunner
from api_server.app_router import AppRoute, Status
from common.logger import AppLogger
from common.state.app_status import AppStatus


DATA_ROOT = os.environ.get('DATA_ROOT', '.')
UPLOAD_BASE = f"{DATA_ROOT}/multi-fileupload"
RESPONSE_BASE = f"{DATA_ROOT}/create-label-responce"


router = APIRouter(prefix='/api', route_class=AppRoute)


class CreateLabelRunner(BackendTaskRunner):

    task_type = 'create-label'

    def get_params(self, app_state, req_status):
        in_dir = f"{UPLOAD_BASE}/{req_status.get_hash_key()}/"
        out_dir = f"{RESPONSE_BASE}/{req_status.get_hash_key()}/"
        f_list = [f for f in os.listdir(in_dir) if f != '.gitkeep']
        img = [f for f in f_list if not f.lower().endswith(".pdf")][0]
        return {
            'in_dir': in_dir,
            'image': img,
            'out_dir': out_dir,
        }


def _pdfs_to_jpegs(upload_dir: str) -> None:
    """Pre-convert any PDFs in upload_dir to JPEGs in place so the batch task
    only has to handle images."""
    pdf_dir = Path(upload_dir)
    pdf_files = list(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        return
    for pdf_path in pdf_files:
        images = convert_from_path(pdf_path)
        for i, image in enumerate(images):
            new_stem = pdf_path.with_stem(f"{pdf_path.stem}_{i}")
            image.save(new_stem.with_suffix(".jpg"), 'JPEG')


@router.post("/create-label/")
async def create_label(request: Request):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    upload_dir = f"{UPLOAD_BASE}/{req_status.get_hash_key()}"

    target_status = req_status.status
    match target_status:
        case Status.START:
            logger.log(
                    req_status, AppLogger.DEBUG,
                    "CREATE-LABEL START STATUS START")
            if os.path.exists(upload_dir):
                _pdfs_to_jpegs(upload_dir)
                app_state.update_app_status(req_status)
                BackendTasks.publish(req_status, CreateLabelRunner())
            else:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"CREATE-LABEL UPLOAD DIR NOT FOUND:{upload_dir}")
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.DOING:
            logger.log(
                    req_status, AppLogger.DEBUG,
                    "CREATE-LABEL DOING STATUS START")
            app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.END:
            logger.log(
                    req_status, AppLogger.DEBUG,
                    "CREATE-LABEL END STATUS START")
            app_status = app_state.get_eq_app_status(req_status)
            if app_status is None or app_status.status != Status.END:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"CREATE-LABEL REQUEST IS NOT END:{req_status.status}")
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
                return AppRoute.create_responce_from_status(req_status)

            res_dir = f"{RESPONSE_BASE}/{req_status.get_hash_key()}/"
            fname_list = os.listdir(res_dir)

            image_exts = (
                ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp")
            image_files = [f"{res_dir}/{f}"
                           for f in fname_list
                           if f.lower().endswith(image_exts)]
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
            with zipfile.ZipFile(
                    io, mode='w', compression=zipfile.ZIP_DEFLATED) as zip:
                for fpath in file_list:
                    zip.write(fpath)
            app_state.update_app_status(req_status)
            return StreamingResponse(
                iter([io.getvalue()]),
                media_type="application/x-zip-compressed",
                headers={
                   "Content-Disposition": f"attachment;filename={zip_filename}"
                }
            )
