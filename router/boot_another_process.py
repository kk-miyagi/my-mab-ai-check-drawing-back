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

    BOOT_ANOTHER_PROCESS_SESSION_KEY = "BOOT_ANOTHER_PROCESS_SESSION_KEY"
    user: str
    user: str
    epic: str
    operation: str
    operation_id: str
    status: str

    def __init__(self):
        
        LOG_FILENAME = "logs/base_boot_another_process.log"
        LOG_FORMAT = "[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
        UTF_8 = "utf-8"

        self.logger = logging.getLogger(__name__)
        logging.basicConfig(
            filename = LOG_FILENAME,
            format = LOG_FORMAT,
            level = logging.INFO,
            encoding = UTF_8,
        )

    def start(self, req_status, cmd):
        try:
            asyncio.run(self.do(req_status, cmd))  # TODO: マルチファイルアップロードを参考にしてみる

        except Exception as e:
            self.logger.error(f"error: {e}")
            # TODO error handling
            raise e

    async def do(self, req_status, cmd: str):
        try:
            self.logger.info(f"start batch: {req_status}")
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            self.logger.info(f"stdout: {stdout.decode()}")
            self.logger.info(f"stdout: {stderr.decode()}")
            if proc.returncode == 0:
                req_status.status = Status.END

            # 渡された関数を呼ぶ?
            # xxxxxx(ここでステータスを更新する)
            # バッチ処理のステータスと全体のステータスの両方を更新する
            
            self.logger.info(f"end batch: {req_status}")
        except Exception as e:
            self.logger.error(f"error: {e}")
            # TODO error handling
            raise e

        return None


@router.post("/base-boot-another-process")
async def boot_process(request: Request, background_tasks: BackgroundTasks):
    proc = BaseBootAnotherProcess()
    state = request.state
    # 初回呼び出しであれば実行？stateの中にあるステータスに応じて処理を変えたいが、stateの値はどうやって取得する？
    req_status = AppStatus.create_from_state(state)
    match req_status.status:
        case Status.START:
            cmd = "bash ./scripts/test.sh"
            background_tasks.add_task(proc.start, req_status, cmd)

            return JSONResponse(content={"message": "start batch"})

        case Status.DOING:
            return JSONResponse(content={"message": "doing batch"})
        
        case Status.END:
            return JSONResponse(content={"message": "end batch"})
