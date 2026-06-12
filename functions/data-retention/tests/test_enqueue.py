import json

from retention_config import build_job, enqueue_retention_job


class FakeRedis:
    def __init__(self):
        self.added = []

    def xadd(self, stream, fields):
        self.added.append((stream, fields))
        return "1-0"


def test_build_job_has_system_envelope_and_cmd():
    job = build_job("DEV")
    assert job["cmd"] == "python backend_tasks/retention_delete_task.py DEV"
    assert job["user"] == "SYSTEM"
    assert job["group_id"] == "SYSTEM"
    assert job["operation"] == "retention"


def test_enqueue_publishes_payload_to_stream():
    redis = FakeRedis()
    config = {"QUEUE": {"stream": "jobs:batch"}}
    msg_id = enqueue_retention_job(config, redis, "PROD")
    assert msg_id == "1-0"
    stream, fields = redis.added[0]
    assert stream == "jobs:batch"
    payload = json.loads(fields["payload"])
    assert payload["cmd"].endswith("retention_delete_task.py PROD")
    assert payload["group_id"] == "SYSTEM"
