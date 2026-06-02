from typing import Iterator, Tuple
from common.queue.job_schema import Job


class JobConsumer:
    """Reads jobs from a Redis Stream consumer group.

    Uses XREADGROUP with BLOCK so the worker sleeps between jobs instead of
    busy-looping. On startup, drains the consumer's pending list first so any
    jobs in-flight when the worker last crashed get retried.
    """

    def __init__(
            self,
            redis_client,
            stream: str,
            group: str,
            consumer_name: str,
            block_ms: int = 5000,
            count: int = 1):
        self.redis_client = redis_client
        self.stream = stream
        self.group = group
        self.consumer_name = consumer_name
        self.block_ms = block_ms
        self.count = count
        self._ensure_group()

    def _ensure_group(self):
        try:
            self.redis_client.xgroup_create(
                name=self.stream,
                groupname=self.group,
                id='0',
                mkstream=True,
            )
        except Exception as exc:
            # BUSYGROUP raised when the group already exists; safe to ignore.
            if 'BUSYGROUP' not in str(exc):
                raise

    def iter_jobs(self) -> Iterator[Tuple[str, Job]]:
        """Yield (msg_id, Job). Caller must call ack(msg_id) when done."""
        # Drain this consumer's pending list first (recover crashed jobs).
        yield from self._drain_pending()
        # Then loop forever reading new entries.
        while True:
            response = self.redis_client.xreadgroup(
                groupname=self.group,
                consumername=self.consumer_name,
                streams={self.stream: '>'},
                count=self.count,
                block=self.block_ms,
            )
            if not response:
                continue
            for _stream_name, messages in response:
                for msg_id, fields in messages:
                    yield msg_id, Job.from_stream_fields(fields)

    def _drain_pending(self) -> Iterator[Tuple[str, Job]]:
        while True:
            response = self.redis_client.xreadgroup(
                groupname=self.group,
                consumername=self.consumer_name,
                streams={self.stream: '0'},
                count=self.count,
                block=0,
            )
            if not response:
                return
            has_messages = False
            for _stream_name, messages in response:
                for msg_id, fields in messages:
                    has_messages = True
                    yield msg_id, Job.from_stream_fields(fields)
            if not has_messages:
                return

    def ack(self, msg_id: str):
        self.redis_client.xack(self.stream, self.group, msg_id)
