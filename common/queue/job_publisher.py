from common.queue.job_schema import Job


class JobPublisher:
    """Pushes jobs onto a Redis Stream (XADD). One stream is shared across
    all task types; consumers route by `task_type`."""

    def __init__(self, redis_client, stream: str):
        self.redis_client = redis_client
        self.stream = stream

    def publish(self, job: Job) -> str:
        msg_id = self.redis_client.xadd(
            self.stream,
            job.to_stream_fields(),
        )
        return msg_id
