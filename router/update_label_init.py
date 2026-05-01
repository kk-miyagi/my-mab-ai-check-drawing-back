import re
import zipfile
from pathlib import Path
from datetime import datetime
from io import BytesIO
from fastapi import Request, APIRouter
from fastapi.responses import StreamingResponse
from state.app_status import AppStatus, Status
from app_router import AppRoute
from app_logger import AppLogger

router = APIRouter(prefix='/api', route_class=AppRoute)


@router.post('/update-label-init/')
async def update_label_init(request: Request):
    ret = None
    state = request.state

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()
    req_status = AppStatus.create_from_state(state)

    if req_status.status == Status.START:
        try:
            logger.log(
                req_status,
                AppLogger.DEBUG,
                "UPDATE-LABEL-INIT INIT STATUS START"
            )

            req_epic = req_status.epic
            req_ope = req_status.operation
            req_user = req_status.user
            req_opeid = req_status.operation_id

            base_dir = f'./create-label-responce/{req_user}_{req_epic}_batch-create-label_{req_opeid}'

            img_list = list(Path(base_dir).glob("*.jpg"))
            img_list = [f.as_posix() for f in img_list]

            csv_list = list(Path(base_dir).glob("*.csv"))
            csv_list = [f.as_posix() for f in csv_list]

            pattern = re.compile(r'^job_\d{14}$')
            dirs = [
                d for d in Path(base_dir).iterdir()
                if d.is_dir() and pattern.match(d.name)
            ]
 
            latest_dir = max(dirs, key=lambda d: d.name.split("_")[1])

            rects_json_path = (Path(base_dir) / "rects.json").as_posix()

            file_list = img_list + csv_list + [rects_json_path]
            print(f"file_list: {file_list}")

            io = BytesIO()
            now = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"update-label-init_{now}.zip"
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
        except Exception as e:
            logger.log(
                req_status,
                AppLogger.ERROR,
                f"UPDATE-LABEL-INIT ERROR! : {e}"
            )
            raise e
    else:
        logger.log(
            req_status,
            AppLogger.DEBUG,
            f"UPDATE-LABEL-INIT NOT INIT STATUS: {req_status.status}"
        )

    return ret
