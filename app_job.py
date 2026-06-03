import json


class JobPublisher:
    """FastAPI 側から Redis Streams へジョブを投入する XADD ラッパー。"""

    def __init__(self, redis_client, stream):
        self.redis = redis_client
        self.stream = stream

    def publish(self, job: dict) -> str:
        # Streams はフラットな文字列マップしか持てないため payload を JSON 化する
        return self.redis.xadd(self.stream, {"payload": json.dumps(job)})


class JobConsumer:
    """Batch 側で Redis Streams からジョブを読み出す XREADGROUP ラッパー。

    Consumer Group により複数 worker でロードバランス（各ジョブは1 worker のみ処理）し、
    XACK 前に worker が落ちたジョブは pending list に残り再配信できる（at-least-once）。
    """

    NEW_MESSAGES = ">"
    BACKLOG_START = "0"

    def __init__(self, redis_client, stream, group, consumer, block_ms=5000):
        self.redis = redis_client
        self.stream = stream
        self.group = group
        self.consumer = consumer
        self.block_ms = int(block_ms)
        self._ensure_group()

    def _ensure_group(self):
        try:
            # MKSTREAM で stream が無くても作成。既存なら BUSYGROUP を無視。
            self.redis.xgroup_create(
                self.stream, self.group, id="0", mkstream=True)
        except Exception as e:  # noqa: BLE001
            if "BUSYGROUP" not in str(e):
                raise

    def read(self, last_id):
        """last_id="0" で自分の pending(未ACK) を、">" で新規メッセージを読む。"""
        return self.redis.xreadgroup(
            self.group,
            self.consumer,
            {self.stream: last_id},
            count=1,
            block=self.block_ms,
        )

    def ack(self, msg_id):
        self.redis.xack(self.stream, self.group, msg_id)
