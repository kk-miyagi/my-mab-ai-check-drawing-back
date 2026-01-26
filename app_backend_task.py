from app_router import Status
import asyncio


# TODO logger
class BackendTaskRunner:

    def get_cmd(self, base_cmd, app_state, req_status):
        raise Exception("NOT OVERRIDE")

    def start(self, req_status, app_state, cmd):
        print(f"runner start backend cmd is :{cmd}")
        try:
            asyncio.run(
                self.run(
                    req_status,
                    app_state,
                    cmd
                )
            )
        except Exception as e:
            # TODO error logic
            raise e

    async def run(cls, req_status, app_state, cmd: str):
        # TODO log
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0:
                req_status.status = Status.END

            app_state.update_boot_process_info(
                req_status
            )

        except Exception as e:
            # TODO error handling
            raise e

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
        base_cmd = cls.task_dic[cls._task_state_key(req_status)]
        background_tasks.add_task(
            task_runner.start(
                req_status,
                cls.app_state,
                task_runner.get_cmd(
                    base_cmd,
                    cls.app_state,
                    req_status
                )
            )
        )

    @classmethod
    def _task_state_key(cls, req_status):
        return '_'.join(
            [
                req_status.epic,
                req_status.operation
            ]
        )
