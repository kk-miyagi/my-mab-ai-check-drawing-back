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

router = APIRouter(route_class=AppRoute)


class DrawingCompareRunner(BackendTaskRunner):

    _BASE_DIR = './drawing-compare-responce'
    def get_cmd(self, base_cmd, app_state, req_status):
        req = req_status
        # TODO: 引数が決まっていないため確定後に入れる
        return f"{base_cmd}"


@router.post("/drawing-compare/")
async def drawing_compare(request: Request, background_tasks: BackgroundTasks):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    req_combinations = state.combinations
    req_combinations = json.loads(req_combinations)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    base_dir = './drawing-compare-responce'
    up_epic = 'drawing-compare'
    up_ope = 'image-similarity'

    req_user = req_status.user
    req_opid = req_status.operation_id

    cut_base_dir = f'{base_dir}/{req_user}_{up_epic}_{up_ope}_{req_opid}/cut_base'
    cut_target_dir = f'{base_dir}/{req_user}_{up_epic}_{up_ope}_{req_opid}/cut_target'

    match req_status.status:
        case Status.START:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DRAWING-COMPARE START STATUS START"
            )

            if os.path.exists(cut_base_dir) and os.path.exists(cut_target_dir):
                # app_status 作成
                app_state.create_new_app_status(
                    req_status
                )

                # 別プロセスにてラベル付与実行
                BackendTasks.set_backend_runner(
                    req_status,
                    DrawingCompareRunner(),
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
            # 2)ダウンロード先ディレクトリから図面ファイル、CSVファイル読み込み
            ope_dir = f"{req_status.user}_{req_status.epic}_"
            ope_dir += f"{req_status.operation}_{req_status.operation_id}/"
            res_dir = f"./drawing-compare-responce/{ope_dir}"
            fname_list = os.listdir(res_dir)
            file_list = [
                res_dir + fname for fname in fname_list if fname != ".gitkeep"
            ]
            # TODO File name kara 1_bf_fileを除く
            # CSVの最後の列を除く
            pass
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
