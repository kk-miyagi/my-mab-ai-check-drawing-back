from fastapi import BackgroundTasks, Request
from fastapi.responses import JSONResponse
import asyncio
import logging
from dataclasses import dataclass
from manager.app_status_manager import AppStatus
from app_router import AppRouter, Status


router = AppRouter()


@dataclass
class BaseBootAnotherProcess:

    user: str
    epic: str
    operation: str
    operation_id: str
    status: str
    
    BOOT_ANOTHER_PROCESS_SESSION_KEY = "BOOT_ANOTHER_PROCESS_SESSION_KEY"

    LOG_FILENAME = "logs/base_boot_another_process.log"
    LOG_FORMAT = "[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
    UTF_8 = "utf-8"

    logger = logging.getLogger(__name__)
    logging.basicConfig(
        filename = LOG_FILENAME,
        format = LOG_FORMAT,
        level = logging.INFO,
        encoding = UTF_8,
    )

    @classmethod
    def create_boot_process_session(cls, app_session):
        if not hasattr(app_session, cls.BOOT_ANOTHER_PROCESS_SESSION_KEY):
            app_session.BOOT_ANOTHER_PROCESS_SESSION_KEY = {}

    @classmethod
    def update_boot_process_session(cls, status, app_session):
        session_dic = app_session.BOOT_ANOTHER_PROCESS_SESSION_KEY
        if status.get_hash_key() not in session_dic:
            session_dic[status.get_hash_key()] = BaseBootAnotherProcess(
                    status.user,
                    status.epic,
                    status.operation,
                    status.operation_id,
                    status.status
            )
        else:
            loader = session_dic[status.get_hash_key()]
            loader.status = status.status

    @classmethod
    def batch_start(cls, req_status, cmd):
        try:
            asyncio.run(cls.batch_run(req_status, cmd))
        except Exception as e:
            cls.logger.error(f"error: {e}")
            # TODO error handling
            raise e

    @classmethod
    async def batch_run(cls, req_status, cmd: str):
        try:
            cls.logger.info(f"start batch: {req_status}")
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            cls.logger.info(f"stdout: {stdout.decode()}")
            cls.logger.info(f"stdout: {stderr.decode()}")
            if proc.returncode == 0:
                req_status.status = Status.END
            
            cls.update_boot_process_session(
                req_status,
                router.app_session
            )
            
            cls.logger.info(f"end batch: {req_status}")
        except Exception as e:
            cls.logger.error(f"error: {e}")
            # TODO error handling
            raise e

        return None


@router.post("/base-boot-another-process")
async def boot_process(request: Request, background_tasks: BackgroundTasks):
    state = request.state
    req_status = AppStatus.create_from_state(state)
    match req_status.status:
        case Status.START:
            # TODO: STARTの場合はどうするか？
            return JSONResponse(content={"message": "error"})
        case Status.DOING:
            BaseBootAnotherProcess.create_boot_process_session(
                router.app_session
            )
            BaseBootAnotherProcess.update_boot_process_session(
                req_status,
                router.app_session
            )
            cmd = "bash ./scripts/test.sh"
            background_tasks.add_task(BaseBootAnotherProcess.batch_start, req_status, cmd)
            return JSONResponse(content={"message": "doing batch"})

        case Status.END:
            # TODO: ENDの場合はどうするか？
            return JSONResponse(content={"message": "end batch"})

@router.post("/check-base-boot-another-process")
async def check_status(request: Request):
    try:
        session_dic = router.app_session.BOOT_ANOTHER_PROCESS_SESSION_KEY
        state = request.state
        key = AppStatus.create_from_state(state).get_hash_key()
        if key in session_dic:
            loader = session_dic[key]
            return JSONResponse(content={"message": f"{Status.status_to_str(loader.status)}"})

    except Exception as e:
        raise e
