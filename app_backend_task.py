from app_router import Status
from app_logger import BatchLogger
import subprocess


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
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
            )
            self.logger.log(
                req_status,
                BatchLogger.INFO,
                f"backend result :{result.stdout}"
            )
            if result.returncode == 0:
                req_status.status = Status.END
            else:
                self.logger.log(
                    req_status,
                    BatchLogger.ERROR,
                    f"backend stderr:{result.stderr}"
                )
                req_status.status = Status.ERROR
        except subprocess.CalledProcessError as e:
            self.logger.log(
                req_status,
                BatchLogger.INFO,
                f"backend error!!: {e}"
            )
            req_status.status = Status.ERROR
        except Exception as e:
            self.logger.log(
                req_status,
                BatchLogger.INFO,
                f"backend error!!: {e}"
            )
            req_status.status = Status.ERROR

        # app status update
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
            background_tasks,
            task_runner: BackendTaskRunner):
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

    @classmethod
    def _task_state_key(cls, req_status):
        return '_'.join(
            [
                req_status.epic,
                req_status.operation
            ]
        )
