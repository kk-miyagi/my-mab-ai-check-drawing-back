import json
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
RESPONSE_BASE = f"{DATA_ROOT}/drawing-compare-responce"

_UP_EPIC = 'drawing-compare'
_UP_OPE = 'image-similarity'
_UP_BASE_OPE = 'upload-base'
_UP_TARGET_OPE = 'upload-target'


router = APIRouter(prefix='/api', route_class=AppRoute)


class DrawingCompareRunner(BackendTaskRunner):

    task_type = 'drawing-compare'

    def __init__(self, combinations):
        self.combinations = combinations

    def get_params(self, app_state, req_status):
        req = req_status
        cut_base_dir = (
            f"{RESPONSE_BASE}/{req.user}_{_UP_EPIC}_{_UP_OPE}_"
            f"{req.operation_id}/cut_base")
        cut_target_dir = (
            f"{RESPONSE_BASE}/{req.user}_{_UP_EPIC}_{_UP_OPE}_"
            f"{req.operation_id}/cut_target")
        out_dir = f"{RESPONSE_BASE}/{req.get_hash_key()}"
        upload_base_dir = (
            f"{UPLOAD_BASE}/{req.user}_{_UP_EPIC}_{_UP_BASE_OPE}_"
            f"{req.operation_id}")
        upload_target_dir = (
            f"{UPLOAD_BASE}/{req.user}_{_UP_EPIC}_{_UP_TARGET_OPE}_"
            f"{req.operation_id}")
        upload_base_path = list(
                Path(upload_base_dir).glob("*.jpg"))[0].as_posix()
        upload_target_path = list(
                Path(upload_target_dir).glob("*.jpg"))[0].as_posix()
        return {
            'base_image_path': upload_base_path,
            'target_image_path': upload_target_path,
            'base_cut_dir': cut_base_dir,
            'target_cut_dir': cut_target_dir,
            'out_dir': out_dir,
            'combinations': self.combinations,
        }


@router.post("/drawing-compare/")
async def drawing_compare(request: Request):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    req_combinations = state.combinations

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    req_user = req_status.user
    req_opid = req_status.operation_id

    cut_base_dir = (
        f"{RESPONSE_BASE}/{req_user}_{_UP_EPIC}_{_UP_OPE}_"
        f"{req_opid}/cut_base")
    cut_target_dir = (
        f"{RESPONSE_BASE}/{req_user}_{_UP_EPIC}_{_UP_OPE}_"
        f"{req_opid}/cut_target")
    out_dir = f'{RESPONSE_BASE}/{req_status.get_hash_key()}'

    target_status = req_status.status
    match target_status:
        case Status.START:
            logger.log(
                    req_status, AppLogger.DEBUG,
                    "DRAWING-COMPARE START STATUS START")
            app_state.update_app_status(req_status)
            if req_combinations:
                out_json_path = Path(f'{out_dir}/combinations.json')
                out_json_path.parent.mkdir(parents=True, exist_ok=True)
                req_combinations = json.loads(req_combinations)
                with open(out_json_path, 'w', encoding='utf-8') as f:
                    json.dump(
                            req_combinations, f, ensure_ascii=False, indent=2)
            else:
                app_state.create_new_app_status(req_status)
                BackendTasks.publish(
                    req_status, DrawingCompareRunner(req_combinations))
                return AppRoute.create_responce_from_status(req_status)

            if os.path.exists(cut_base_dir) and os.path.exists(cut_target_dir):
                BackendTasks.publish(
                    req_status, DrawingCompareRunner(req_combinations))
            else:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"DRAWING-COMPARE UPLOAD DIR NOT FOUND:"
                    f"{cut_base_dir} or {cut_target_dir}")
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.DOING:
            logger.log(
                    req_status, AppLogger.DEBUG,
                    "DRAWING-COMPARE DOING STATUS START")
            app_state.update_app_status(req_status)
            return AppRoute.create_responce_from_status(req_status)

        case Status.END:
            logger.log(
                    req_status, AppLogger.DEBUG,
                    "DRAWING-COMPARE END STATUS START")
            app_status = app_state.get_eq_app_status(req_status)
            if app_status is None or app_status.status != Status.END:
                logger.log(
                    req_status, AppLogger.ERROR,
                    f"DRAWING-COMPARE REQUEST IS NOT END:{req_status.status}")
                req_status.status = Status.ERROR
                app_state.update_app_status(req_status)
                return AppRoute.create_responce_from_status(req_status)

            res_dir = f"{RESPONSE_BASE}/{req_status.get_hash_key()}/"
            fname_list = os.listdir(res_dir)
            extensions = ('.csv', '.jpg', 'pdf')
            file_list = [
                res_dir + fname for fname in fname_list
                if fname.endswith(extensions)
            ]
            io = BytesIO()
            now = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"drawing-compare_{now}.zip"
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
