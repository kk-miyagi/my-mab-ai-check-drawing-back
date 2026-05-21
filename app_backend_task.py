from app_router import Status
from app_logger import BatchLogger
import asyncio
import os


class BackendTaskRunner:

    def set_logger(self, logger):
        self.logger = logger

    def get_cmd(self, base_cmd, app_state, req_status):
        raise Exception("NOT OVERRIDE")

    async def start(self, req_status, app_state, cmd):
        self.logger.log(
            req_status,
            BatchLogger.INFO,
            f"**** runner start backend cmd is :{cmd} *****"
        )
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd.split(' '),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}
            )

            async def read_and_log_stream(
                    stream,
                    head_str,
                    logger,
                    log_level,
                    status):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    mess = f"[{head_str}] "
                    mess += f"{line.decode(app_state.system_encode).strip()}"

                    logger.log(
                        status,
                        log_level,
                        mess
                    )
            await asyncio.gather(
                read_and_log_stream(
                    process.stdout,
                    "STD-OUT",
                    self.logger,
                    BatchLogger.INFO,
                    req_status
                ),
                read_and_log_stream(
                    process.stderr,
                    "STD-ERR",
                    self.logger,
                    BatchLogger.INFO,
                    req_status
                )
            )
            return_code = await process.wait()
            if return_code == 0:
                up_status = Status.END
            else:
                up_status = Status.ERROR
                self.logger.log(
                    req_status,
                    BatchLogger.ERROR,
                    f"backend stderr:{return_code}"
                )
        except Exception as e:
            self.logger.log(
                req_status,
                BatchLogger.INFO,
                f"backend error!!: {e}"
            )
            up_status = Status.ERROR

        req_status.status = up_status
        # app status update
        app_state.update_app_status(
            req_status
        )
        state_status = app_state.get_eq_app_status(req_status)

        if all([ope.status == Status.END for ope in state_status.operations]):
            req_status.group_status = up_status
            app_state.update_app_status(
                req_status
            )

        if any([ope.status == Status.ERROR for ope in state_status.operations]):
            req_status.group_status = Status.ERROR
            app_state.update_app_status(
                req_status
            )

        self.logger.log(
            req_status,
            BatchLogger.INFO,
            f"**** runner end backend cmd is :{cmd} *****"
        )
        return None


class BackendTasks:

    @classmethod
    def setup(cls, conf, app_state, logger):
        cls.logger = logger
        cls.app_state = app_state
        cls.task_dic = conf.backend_tasks

    @classmethod
    def set_backend_runner(
            cls,
            req_status,
            task_runner: BackendTaskRunner,
            background_tasks):
        cls.logger.log(
            req_status,
            BatchLogger.DEBUG,
            "BACKEND TASK SET START !!"
        )
        base_cmd = cls.task_dic[cls._task_state_key(req_status)]

        task_runner.set_logger(cls.logger)
        background_tasks.add_task(
                task_runner.start,
                req_status,
                cls.app_state,
                task_runner.get_cmd(
                    base_cmd,
                    cls.app_state,
                    req_status
                )
            )
        cls.logger.log(
            req_status,
            BatchLogger.DEBUG,
            "BACKEND TASK SET END !!"
        )
        # TODO session status update

    @classmethod
    def _task_state_key(cls, req_status):
        return '_'.join([req_status.epic, req_status.operation])
