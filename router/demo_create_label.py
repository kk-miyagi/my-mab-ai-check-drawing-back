from fastapi import BackgroundTasks, Request, APIRouter
from fastapi.responses import StreamingResponse
from state.app_status import AppStatus
from app_router import AppRoute, Status
from app_logger import AppLogger
from io import BytesIO
import zipfile
import os

router = APIRouter(route_class=AppRoute)


@router.post("/demo-create-label/")
async def create_label(request: Request, background_tasks: BackgroundTasks):
    state = request.state
    req_status = AppStatus.create_from_state(state)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()
    up_epic = 'create_label'
    up_ope = 'multi-file-upload'

    req_user = req_status.user
    req_opid = req_status.operation_id
    upload_dir = f"./mlti-fileupload/{req_user}_{up_epic}_{up_ope}_{req_opid}"

    match req_status.status:
        case Status.START:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DEMO-CREATE-LABEL START STATUS START"
            )
            if os.path.exists(upload_dir):
                # app_status 作成
                app_state.create_new_app_status(
                    req_status
                )
                # app_status 更新
                req_status = Status.END
                app_state.update_app_status()
            else:
                req_status.status = Status.ERROR
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"DEMO-CREATE-LABEL UPLOAD DIR NOT FOUND:{upload_dir}"
                )
            return AppRoute.create_responce_from_status(
                    req_status
            )
        case Status.DOING:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DEMO-CREATE-LABEL DOING STATUS START"
            )
        case Status.END:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DEMO-CREATE-LABEL END STATUS START"
            )
            # 1)status END確認
            app_status = app_state.get_eq_app_status(req_status)
            if app_status is None or app_status.status != Status.END:
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"DEMO-CREATE-LABEL REQUEST IS NOT END:{req_status.status}"
                )
                req_status.staus = Status.ERROR
                return AppRoute.create_responce_from_status(
                        req_status
                )
            # 2)ダウンロード先ディレクトリから図面ファイル、CSVファイル読み込み
            fname_list = os.listdir("./demo-create-label-responce/")
            file_list = []
            for fname in fname_list:
                with open(fname, 'rb') as f:
                    file_list.append(f)

            # 3)ZIPに固めてダウンロードの返信を実施
            io = BytesIO()
            zip_filename = "demo-create-label.zip"
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
