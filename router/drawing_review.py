from fastapi import Request, APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse
from state.app_status import AppStatus
from app_router import AppRoute, Status
from app_logger import AppLogger
from app_backend_task import BackendTasks, BackendTaskRunner
from datetime import datetime
from io import BytesIO
import os
import zipfile

router = APIRouter(prefix='/api', route_class=AppRoute)


class DrawingReviewRunner(BackendTaskRunner):

    _IN_BASE_DIR = './multi-fileupload'
    _OUT_BASE_DIR = './drawing-review-responce'
    _EPIC = 'drawing-review'
    _IN_OPE_EXCEL = 'upload-excel'
    _IN_OPE_IMAGES = 'upload-images'

    def get_cmd(self, base_cmd, app_state, req_status):
        req = req_status
        in_dir_excel = f"{self._IN_BASE_DIR}/{req.user}_{self._EPIC}_{self._IN_OPE_EXCEL}_{req.operation_id}/"
        in_dir_images = f"{self._IN_BASE_DIR}/{req.user}_{self._EPIC}_{self._IN_OPE_IMAGES}_{req.operation_id}/"
        out_dir = f"{self._OUT_BASE_DIR}/{req.get_hash_key()}/"
        return f"{base_cmd} {in_dir_excel} {in_dir_images} {out_dir}"


@router.post("/drawing-review/")
async def drawing_review(request: Request, background_tasks: BackgroundTasks):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()
    up_epic = 'drawing-review'
    up_excel_ope = 'upload-excel'
    up_image_ope = 'upload-images'

    req_user = req_status.user
    req_opid = req_status.operation_id
    upload_excel_dir = f"./multi-fileupload/{req_user}_{up_epic}_{up_excel_ope}_{req_opid}"
    upload_image_dir = f"./multi-fileupload/{req_user}_{up_epic}_{up_image_ope}_{req_opid}"

    target_status = req_status.status
    match target_status:
        case Status.START:
            logger.log(req_status, AppLogger.DEBUG, "DRAWING-REVIEW START STATUS START")
            app_state.update_app_status(req_status)
            if os.path.exists(upload_excel_dir) and os.path.exists(upload_image_dir):
                BackendTasks.set_backend_runner(
                    req_status, DrawingReviewRunner(), background_tasks)
            else:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"DRAWING-REVIEW UPLOAD DIR NOT FOUND:{upload_excel_dir} or {upload_image_dir}")
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.DOING:
            logger.log(req_status, AppLogger.DEBUG, "DRAWING-REVIEW DOING STATUS START")
            app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.END:
            logger.log(req_status, AppLogger.DEBUG, "DRAWING-REVIEW END STATUS START")
            app_status = app_state.get_eq_app_status(req_status)
            if app_status is None or app_status.status != Status.END:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"DRAWING-REVIEW REQUEST IS NOT END:{req_status.status}")
                req_status.status = Status.ERROR
                return AppRoute.create_responce_from_status(req_status)

            res_dir = f"./drawing-review-responce/{req_status.get_hash_key()}/"
            fname_list = os.listdir(res_dir)
            file_list = [res_dir + fname for fname in fname_list if fname != ".gitkeep"]

            io = BytesIO()
            now = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"drawing-review_{now}.zip"
            with zipfile.ZipFile(io, mode='w', compression=zipfile.ZIP_DEFLATED) as zip:
                for fpath in file_list:
                    zip.write(fpath)
            app_state.update_app_status(req_status)
            return StreamingResponse(
                iter([io.getvalue()]),
                media_type="application/x-zip-compressed",
                headers={"Content-Disposition": f"attachment;filename={zip_filename}"}
            )
