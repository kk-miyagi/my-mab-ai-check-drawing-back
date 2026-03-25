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
import json
from pathlib import Path

router = APIRouter(prefix='/api', route_class=AppRoute)


class DrawingCompareRunner(BackendTaskRunner):

    _BASE_DIR = './drawing-compare-responce'
    _UP_EPIC = 'drawing-compare'
    _UP_OPE = 'image-similarity'
    _UP_BASE_OPE = 'upload-base'
    _UP_TARGET_OPE = 'upload-target'

    def __init__(self, combinations: dict):
        self.combinations = combinations


    def get_cmd(self, base_cmd, app_state, req_status):
        req = req_status
        combinations = self.combinations
        combinations = f'"{str(combinations).strip()}"'
        cut_base_dir = f'{self._BASE_DIR}/{req.user}_{self._UP_EPIC}_{self._UP_OPE}_{req.operation_id}/cut_base'
        cut_target_dir = f'{self._BASE_DIR}/{req.user}_{self._UP_EPIC}_{self._UP_OPE}_{req.operation_id}/cut_target'
        out_dir = f'{self._BASE_DIR}/{req.user}_{req.epic}_{req.operation}_{req.operation_id}'

        upload_base_file_dir = f"./multi-fileupload/{req.user}_{self._UP_EPIC}_{self._UP_BASE_OPE}_{req.operation_id}"
        upload_target_file_dir = f"./multi-fileupload/{req.user}_{self._UP_EPIC}_{self._UP_TARGET_OPE}_{req.operation_id}"
        upload_base_file_path = list(Path(upload_base_file_dir).glob("*.jpg"))[0].as_posix()
        upload_target_file_path = list(Path(upload_target_file_dir).glob("*.jpg"))[0].as_posix()

        return f"{base_cmd} {upload_base_file_path} {upload_target_file_path} {cut_base_dir} {cut_target_dir} {out_dir}"


@router.post("/drawing-compare/")
async def drawing_compare(request: Request, background_tasks: BackgroundTasks):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    req_combinations = state.combinations

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    base_dir = './drawing-compare-responce'
    up_epic = 'drawing-compare'
    up_ope = 'image-similarity'

    req_user = req_status.user
    req_opid = req_status.operation_id
    req_op = req_status.operation

    cut_base_dir = f'{base_dir}/{req_user}_{up_epic}_{up_ope}_{req_opid}/cut_base'
    cut_target_dir = f'{base_dir}/{req_user}_{up_epic}_{up_ope}_{req_opid}/cut_target'

    out_dir = f'{base_dir}/{req_user}_{up_epic}_{req_op}_{req_opid}'

    match req_status.status:
        case Status.START:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DRAWING-COMPARE START STATUS START"
            )

            if req_combinations:
                out_json_path = Path(f'{out_dir}/combinations.json')
                out_json_path.parent.mkdir(parents=True, exist_ok=True)
                req_combinations = json.loads(req_combinations)
                with open(out_json_path, 'w', encoding='utf-8') as f:
                    json.dump(req_combinations, f, ensure_ascii=False, indent=2)
            else:
                # app_status 作成
                app_state.create_new_app_status(
                    req_status
                )

                # 別プロセスにてラベル付与実行
                BackendTasks.set_backend_runner(
                    req_status,
                    DrawingCompareRunner(req_combinations),
                    background_tasks
                )
                return AppRoute.create_responce_from_status(
                    req_status
                )

            if os.path.exists(cut_base_dir) and os.path.exists(cut_target_dir):
                # app_status 作成
                app_state.create_new_app_status(
                    req_status
                )

                # 別プロセスにてラベル付与実行
                BackendTasks.set_backend_runner(
                    req_status,
                    DrawingCompareRunner(req_combinations),
                    background_tasks
                )
            else:
                req_status.status = Status.ERROR
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"DRAWING-COMPARE UPLOAD DIR NOT FOUND:{cut_base_dir} or {cut_target_dir}"
                )
            return AppRoute.create_responce_from_status(
                req_status
            )
        case Status.DOING:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DRAWING-COMPARE DOING STATUS START"
            )
            # requestと同じステータス
            return AppRoute.create_responce_from_status(
                req_status
            )
        case Status.END:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DRAWING-COMPARE END STATUS START"
            )
            # 1)status END確認
            app_status = app_state.get_eq_app_status(req_status)
            if app_status is None or app_status.status != Status.END:
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"DRAWING-COMPARE REQUEST IS NOT END:{req_status.status}"
                )
                req_status.staus = Status.ERROR
                return AppRoute.create_responce_from_status(
                    req_status
                )
            # 2)ダウンロード先ディレクトリからCSVファイル読み込み
            ope_dir = f"{req_status.user}_{req_status.epic}_"
            ope_dir += f"{req_status.operation}_{req_status.operation_id}/"
            res_dir = f"./drawing-compare-responce/{ope_dir}"
            fname_list = os.listdir(res_dir)
            file_list = [
                res_dir + fname for fname in fname_list if fname.endswith('.csv')
            ]
            # 3)ZIPに固めてダウンロードの返信を実施
            io = BytesIO()
            now = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"drawing-compare_{now}.zip"
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
