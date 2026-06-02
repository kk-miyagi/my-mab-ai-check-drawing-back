from common.logger import BatchLogger
from common.queue.job_publisher import JobPublisher
from common.queue.job_schema import Job


class BackendTaskRunner:
    """Per-route helper that knows how to build a job payload for a specific
    task type. Subclasses override `get_params()` (and may set `task_type`).
    """

    task_type: str = None

    def get_params(self, app_state, req_status) -> dict:
        raise Exception("NOT OVERRIDE")


class BackendTasks:

    @classmethod
    def setup(cls, conf, app_state, logger):
        cls.logger = logger
        cls.app_state = app_state
        cls.publisher = JobPublisher(
            redis_client=app_state.redis_client,
            stream=conf.queue_stream,
        )

    @classmethod
    def publish(cls, req_status, task_runner: BackendTaskRunner):
        """Build a Job from the runner + status and XADD it to the stream.
        Returns the Redis message id."""
        cls.logger.log(
            req_status,
            BatchLogger.DEBUG,
            "BACKEND TASK PUBLISH START"
        )
        params = task_runner.get_params(cls.app_state, req_status)
        job = Job(
            task_type=task_runner.task_type,
            user=req_status.user,
            epic=req_status.epic,
            operation=req_status.operation,
            operation_id=req_status.operation_id,
            params=params or {},
        )
        msg_id = cls.publisher.publish(job)
        cls.logger.log(
            req_status,
            BatchLogger.INFO,
            f"BACKEND TASK PUBLISHED job_id={job.job_id} msg_id={msg_id} "
            f"task_type={job.task_type}"
        )
        return msg_id
