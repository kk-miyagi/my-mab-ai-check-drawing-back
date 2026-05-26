import os
import zipfile
from datetime import datetime
from io import BytesIO

from fastapi import Request, APIRouter
from fastapi.responses import StreamingResponse

from api_server.app_backend_task import BackendTasks, BackendTaskRunner
from api_server.app_router import AppRoute, Status
from common.logger import AppLogger
from common.state.app_status import AppStatus


DATA_ROOT = os.environ.get('DATA_ROOT', '.')
UPLOAD_BASE = f"{DATA_ROOT}/multi-fileupload"
RESPONSE_BASE = f"{DATA_ROOT}/drawing-review-responce"

_EPIC = 'drawing-review'
_UP_EXCEL_OPE = 'upload-excel'
_UP_IMAGE_OPE = 'upload-images'


router = APIRouter(prefix='/api', route_class=AppRoute)


class DrawingReviewRunner(BackendTaskRunner):

    task_type = 'drawing-review'

    def get_params(self, app_state, req_status):
        req = req_status
        in_dir_excel = (
            f"{UPLOAD_BASE}/{req.user}_{_EPIC}_{_UP_EXCEL_OPE}_"
            f"{req.operation_id}/")
        in_dir_images = (
            f"{UPLOAD_BASE}/{req.user}_{_EPIC}_{_UP_IMAGE_OPE}_"
            f"{req.operation_id}/")
        out_dir = f"{RESPONSE_BASE}/{req.get_hash_key()}/"
        return {
            'excel_dir': in_dir_excel,
            'pdf_dir': in_dir_images,
            'output_dir': out_dir,
        }


@router.post("/drawing-review/")
async def drawing_review(request: Request):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    req_user = req_status.user
    req_opid = req_status.operation_id
    upload_excel_dir = (
        f"{UPLOAD_BASE}/{req_user}_{_EPIC}_{_UP_EXCEL_OPE}_{req_opid}")
    upload_image_dir = (
        f"{UPLOAD_BASE}/{req_user}_{_EPIC}_{_UP_IMAGE_OPE}_{req_opid}")

    target_status = req_status.status
    match target_status:
        case Status.START:
            logger.log(
                    req_status, AppLogger.DEBUG,
                    "DRAWING-REVIEW START STATUS START")
            app_state.update_app_status(req_status)
            if (os.path.exists(upload_excel_dir) and
                    os.path.exists(upload_image_dir)):
                BackendTasks.publish(req_status, DrawingReviewRunner())
            else:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"DRAWING-REVIEW UPLOAD DIR NOT FOUND:"
                    f"{upload_excel_dir} or {upload_image_dir}")
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.DOING:
            logger.log(
                    req_status, AppLogger.DEBUG,
                    "DRAWING-REVIEW DOING STATUS START")
            app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.END:
            logger.log(
                    req_status, AppLogger.DEBUG,
                    "DRAWING-REVIEW END STATUS START")
            app_status = app_state.get_eq_app_status(req_status)
            if app_status is None or app_status.status != Status.END:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"DRAWING-REVIEW REQUEST IS NOT END:{req_status.status}")
                req_status.status = Status.ERROR
                return AppRoute.create_responce_from_status(req_status)

            res_dir = f"{RESPONSE_BASE}/{req_status.get_hash_key()}/"
            fname_list = os.listdir(res_dir)
            file_list = [res_dir + fname for fname in fname_list
                         if fname != ".gitkeep"]

            io = BytesIO()
            now = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"drawing-review_{now}.zip"
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
