from fastapi import BackgroundTasks, Request, APIRouter
from fastapi.responses import JSONResponse
import asyncio
import logging
from state.app_status import AppStatus
from app_router import AppRoute, Status


router = APIRouter(route_class=AppRoute)


class BaseBootAnotherProcess:
    LOG_FILENAME = "logs/base_boot_another_process.log"
    LOG_FORMAT = "[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
    UTF_8 = "utf-8"

    logger = logging.getLogger(__name__)
    logging.basicConfig(
        filename=LOG_FILENAME,
        format=LOG_FORMAT,
        level=logging.INFO,
        encoding=UTF_8,
    )

    @classmethod
    def batch_start(cls, req_status, cmd):
        try:
            asyncio.run(cls.batch_run(req_status, cmd))
        except Exception as e:
            # TODO log
            # TODO error handling
            raise e

    @classmethod
    async def batch_run(cls, req_status, cmd: str):
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0:
                req_status.status = Status.END

            app_state = AppRoute.get_app_state()
            app_state.update_boot_process_info(
                req_status
            )

        except Exception as e:
            # TODO error handling
            raise e

        return None


# TODO no logic
@router.post("/create-label")
async def boot_process(request: Request, background_tasks: BackgroundTasks):
    state = request.state
    req_status = AppStatus.create_from_state(state)
    # TODO batch用のログもapp_server側から提供されるものを使うように変更する

    match req_status.status:
        case Status.START:
            # TODO
            # 1) 該当するoperation_idのfaileuploadのステータスのセッションを確認
            pass
        case Status.DOING:
            try:
                app_state = AppRoute.get_app_state()
                app_state.create_boot_process_info()
                app_state.update_boot_process_info(
                    req_status
                )
                cmd = "bash ./scripts/test.sh"
                background_tasks.add_task(
                    BaseBootAnotherProcess.batch_start, req_status, cmd)
                return JSONResponse(content={"message": "doing batch"})
            except Exception as e:
                raise e
        case Status.END:
            # TODO: ENDの場合はどうするか？
            return JSONResponse(content={"message": "end batch"})


@router.post("/check")
async def check_status(request: Request):
    try:
        app_state = AppRoute.get_app_state()
        session_dic = app_state.get_session_dict()
        state = request.state
        key = AppStatus.create_from_state(state).get_hash_key()
        if key in session_dic:
            loader = session_dic[key]
            return JSONResponse(
                    content={
                        "message": f"{Status.status_to_str(loader.status)}"})

    except Exception as e:
        raise e
