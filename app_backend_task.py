from app_logger import BatchLogger
from app_job import JobPublisher


class BackendTaskRunner:
    """各 router が継承し get_cmd() で実行コマンド（文字列）を組み立てる。

    旧構成では本クラスの start() が subprocess を起動していたが、
    現在は batch コンテナ側（batch_worker.py）が実行する。
    ここでは get_cmd() でコマンドを組み立てるところまでを担う。
    """

    def set_logger(self, logger):
        self.logger = logger

    def get_cmd(self, base_cmd, app_state, req_status):
        raise Exception("NOT OVERRIDE")


class BackendTasks:

    @classmethod
    def setup(cls, conf, app_state, logger, redis_client):
        cls.logger = logger
        cls.app_state = app_state
        cls.task_dic = conf.backend_tasks
        cls.redis = redis_client
        cls.publisher = JobPublisher(redis_client, conf.queue_stream)

    @classmethod
    def set_backend_runner(
            cls,
            req_status,
            task_runner: BackendTaskRunner,
            background_tasks):
        cls.logger.log(
            req_status,
            BatchLogger.DEBUG,
            "BACKEND TASK PUBLISH START !!"
        )
        task_key = cls._task_state_key(req_status)
        base_cmd = cls.task_dic[task_key]

        task_runner.set_logger(cls.logger)
        cmd = task_runner.get_cmd(base_cmd, cls.app_state, req_status)

        # batch コンテナへ Redis Streams 経由でジョブを投入する
        job = {
            "task_key": task_key,
            "cmd": cmd,
            "user": req_status.user,
            "epic": req_status.epic,
            "group_id": req_status.group_id,
            "operation": req_status.operations[0].operation,
            "operation_id": str(req_status.operations[0].operation_id),
        }
        msg_id = cls.publisher.publish(job)

        cls.logger.log(
            req_status,
            BatchLogger.INFO,
            f"BACKEND TASK PUBLISHED id={msg_id} cmd={cmd}"
        )
        # TODO session status update

    @classmethod
    def _task_state_key(cls, req_status):
        return '_'.join(
            [
                req_status.epic,
                req_status.operations[0].operation
            ]
        )
