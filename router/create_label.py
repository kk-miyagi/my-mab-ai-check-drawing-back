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

router = APIRouter(route_class=AppRoute)


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
        in_dir += f"{req.user}_{self._EPIC}_{self._IN_OPE}_{req.operation_id}/"
        out_dir = f"{self._OUT_BASE_DIR}/"
        out_dir += f"{req.user}_{self._EPIC}"
        out_dir += f"_{self._OUT_OPE}_{req.operation_id}/"
        f_list = [f for f in os.listdir(in_dir) if f != '.gitkeep']
        img = None
        if len(f_list) == 1:
            img = f_list[0]

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
    req_opid = req_status.operation_id
    upload_dir = f"./multi-fileupload/{req_user}_{up_epic}_{up_ope}_{req_opid}"
    match req_status.status:
        case Status.START:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "CREATE-LABEL START STATUS START"
            )
            if os.path.exists(upload_dir):
                # app_status 作成
                app_state.create_new_app_status(
                    req_status
                )
                # 別プロセスにてラベル付与実行
                BackendTasks.set_backend_runner(
                    req_status,
                    CreateLabelRunner(),
                    background_tasks
                )
            else:
                req_status.status = Status.ERROR
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"CREATE-LABEL UPLOAD DIR NOT FOUND:{upload_dir}"
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
            if app_status is None or app_status.status != Status.END:
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"CREATE-LABEL REQUEST IS NOT END:{req_status.status}"
                )
                req_status.staus = Status.ERROR
                return AppRoute.create_responce_from_status(
                    req_status
                )
            # 2)ダウンロード先ディレクトリから図面ファイル、CSVファイル読み込み
            ope_dir = f"{req_status.user}_{req_status.epic}_"
            ope_dir += f"{req_status.operation}_{req_status.operation_id}/"
            res_dir = f"./create-label-responce/{ope_dir}"
            fname_list = os.listdir(res_dir)
            # TODO pdfファイルとcsvファイルだけzipにまとめる
            file_list = [
                res_dir + fname for fname in fname_list if fname != ".gitkeep"
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
            return StreamingResponse(
                iter([io.getvalue()]),
                media_type="application/x-zip-compressed",
                headers={
                   "Content-Disposition": f"attachment;filename={zip_filename}"
                }
            )
