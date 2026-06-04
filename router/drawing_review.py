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
from pathlib import Path
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tools.is_single_page_pdf import is_single_page_pdf

router = APIRouter(prefix='/api', route_class=AppRoute)


class CreateLabelRunner(BackendTaskRunner):

    _IN_BASE_DIR = './multi-fileupload'
    _OUT_BASE_DIR = './drawing-review-responce'
    _EPIC = 'drawing-review'
    _IN_OPE_EXCEL = 'upload-excel'
    _IN_OPE_IMAGES = 'upload-images'
    _OUT_OPE = 'batch-drawing-review'
    _FILE_KEY = 'bf_file'

    def get_cmd(self, base_cmd, app_state, req_status):
        req = req_status
        in_dir_excel = f"{self._IN_BASE_DIR}/"
        in_dir_images = f"{self._IN_BASE_DIR}/"
        in_dir_excel += f"{req.user}_{self._EPIC}_{req.group_id}"
        in_dir_excel += f"_{self._IN_OPE_EXCEL}_{req.operations[0].operation_id}/"
        in_dir_images += f"{req.user}_{self._EPIC}_{req.group_id}"
        in_dir_images += f"_{self._IN_OPE_IMAGES}_{req.operations[0].operation_id}/"
        out_dir = f"{self._OUT_BASE_DIR}/"
        out_dir += f"{req.user}_{self._EPIC}_{req.group_id}"
        out_dir += f"_{self._OUT_OPE}_{req.operations[0].operation_id}/"
        # f_list = [f for f in os.listdir(in_dir) if f != '.gitkeep']
        # img = None
        # if len(f_list) == 1:
        #     img = f_list[0]

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
    req_opid = req_status.operations[0].operation_id
    req_grid = req_status.group_id
    upload_excel_dir = f"./multi-fileupload/{req_user}_{up_epic}_{req_grid}_{up_excel_ope}_{req_opid}"
    upload_image_dir = f"./multi-fileupload/{req_user}_{up_epic}_{req_grid}_{up_image_ope}_{req_opid}"

    target_status = req_status.operations[0].status
    match target_status:
        case Status.START:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DRAWING-REVIEW START STATUS START"
            )
            app_state.update_app_status(
                req_status
            )
            if os.path.exists(upload_excel_dir) and os.path.exists(
                    upload_image_dir):
                for file in list(Path(upload_excel_dir).glob("*.pdf")):
                    if not is_single_page_pdf(file):
                        logger.log(
                            req_status,
                            AppLogger.ERROR,
                            f"DRAWING-REVIEW PDF FILE IS NOT SINGLE PAGE:{file}"
                        )
                        req_status.group_status = Status.ERROR
                        app_state.update_app_status(
                            req_status
                        )
                        return AppRoute.create_responce_from_status(
                            req_status
                        )
                # 別プロセスにてラベル付与実行
                BackendTasks.set_backend_runner(
                    req_status,
                    CreateLabelRunner(),
                    background_tasks
                )
            else:
                req_status.group_status = Status.ERROR
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"DRAWING-REVIEW UPLOAD DIR NOT FOUND:{upload_excel_dir} or {upload_image_dir}"
                )
                up_status = Status.ERROR
                req_status.group_status = up_status
                req_status.operations[0].status = up_status
                app_state.update_app_status(
                    req_status
                )
            return AppRoute.create_responce_from_status(
                req_status
            )
        case Status.DOING:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DRAWING-REVIEW DOING STATUS START"
            )
            # requestと同じステータス
            app_state.update_app_status(
                req_status
            )
            return AppRoute.create_responce_from_status(
                req_status
            )
        case Status.END:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "DRAWING-REVIEW END STATUS START"
            )
            # 1)status END確認
            app_status = app_state.get_eq_app_status(req_status)
            if app_status is None or app_status.group_status != Status.END:
                logger.log(
                    req_status,
                    AppLogger.ERROR,
                    f"DRAWING-REVIEW REQUEST IS NOT END:{req_status.group_status}"
                )
                req_status.group_status = Status.ERROR
                return AppRoute.create_responce_from_status(
                    req_status
                )
            # 2)ダウンロード先ディレクトリから図面ファイル、CSVファイル読み込み
            ope_dir = f"{req_status.user}_{req_status.epic}_{req_status.group_id}"
            ope_dir += f"_{req_status.operations[0].operation}"
            ope_dir += f"_{req_status.operations[0].operation_id}/"
            res_dir = f"./drawing-review-responce/{ope_dir}"
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
            zip_filename = f"drawing-review_{now}.zip"
            with zipfile.ZipFile(
                    io, mode='w', compression=zipfile.ZIP_DEFLATED) as zip:
                for fpath in file_list:
                    zip.write(fpath)
            app_state.update_app_status(
                req_status
            )
            return StreamingResponse(
                iter([io.getvalue()]),
                media_type="application/x-zip-compressed",
                headers={
                   "Content-Disposition": f"attachment;filename={zip_filename}"
                }
            )
