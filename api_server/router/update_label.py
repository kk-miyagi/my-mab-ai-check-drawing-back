import os
import zipfile
from datetime import datetime
from io import BytesIO
from pathlib import Path

from fastapi import Request, APIRouter
from fastapi.responses import StreamingResponse

from api_server.app_backend_task import BackendTasks, BackendTaskRunner
from api_server.app_router import AppRoute, Status
from common.logger import AppLogger
from common.state.app_status import AppStatus


DATA_ROOT = os.environ.get('DATA_ROOT', '.')
UPLOAD_BASE = f"{DATA_ROOT}/multi-fileupload"
RESPONSE_BASE = f"{DATA_ROOT}/update-label-response"

_UP_EPIC = 'create-label'
_IN_OP = 'batch-create-label'


router = APIRouter(prefix='/api', route_class=AppRoute)


class UpdateLabelRunner(BackendTaskRunner):

    task_type = 'update-label'

    def __init__(self, rects_dict, info_dict):
        self.rects_dict = rects_dict
        self.info_dict = info_dict

    def get_params(self, app_state, req_status):
        input_dir = (
            f"{UPLOAD_BASE}/{req_status.user}_{_UP_EPIC}_{_IN_OP}_"
            f"{req_status.operation_id}")
        output_dir = f"{RESPONSE_BASE}/{req_status.get_hash_key()}"
        f_list = [
            f for f in os.listdir(input_dir)
            if f.lower().endswith((".jpg", ".jpeg"))
        ]
        if len(f_list) != 1:
            raise Exception(
                f"Input image file not found or multiple files found "
                f"in {input_dir}")
        input_img = f"{input_dir}/{f_list[0]}"
        return {
            'input_img': input_img,
            'output_dir': output_dir,
            'rects': self.rects_dict,
            'info': self.info_dict,
        }


@router.post("/update-label/")
async def update_label(request: Request):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    output_dir = f"{RESPONSE_BASE}/{req_status.get_hash_key()}"

    target_status = req_status.status
    match target_status:
        case Status.START:
            logger.log(
                req_status, AppLogger.INFO, "UPDATE-LABEL START STATUS")
            app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.DOING:
            logger.log(
                req_status, AppLogger.INFO,
                "UPDATE-LABEL DOING STATUS - publishing job")
            rects_dict = request.state.rects
            info_dict = request.state.info
            app_state.update_app_status(req_status)
            BackendTasks.publish(
                req_status, UpdateLabelRunner(rects_dict, info_dict))
            return AppRoute.create_responce_from_status(req_status)

        case Status.END:
            logger.log(
                req_status, AppLogger.DEBUG, "UPDATE-LABEL END STATUS START")
            app_status = app_state.get_eq_app_status(req_status)
            if app_status is None or app_status.status != Status.END:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"UPDATE-LABEL REQUEST IS NOT END:{req_status.status}")
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
                return AppRoute.create_responce_from_status(req_status)

            fname_list = os.listdir(output_dir)
            extensions = ('.csv', '.pdf')
            file_list = [
                Path(output_dir) / fname
                for fname in fname_list if fname.endswith(extensions)
            ]

            io = BytesIO()
            now = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"update-label_{now}.zip"
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
