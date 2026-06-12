import json

from backend_tasks.retention_delete_task import (
    scan_expired_final,
    run_retention,
)
from state.app_status import AppStatus, Operation, Status


class FakeRedis:
    def __init__(self, mapping=None):
        self._data = dict(mapping or {})

    def scan_iter(self, pattern):
        prefix = pattern.rstrip("*")
        for k in list(self._data.keys()):
            if k.startswith(prefix):
                yield k

    def get(self, key):
        return self._data.get(key)

    def delete(self, key):
        self._data.pop(key, None)


def _entry(status, create_time):
    s = AppStatus("u", "e", "g", status,
                  [Operation("op", "oid", status)], {}, create_time)
    return json.dumps(s.to_dict())


def test_scan_selects_expired_and_final_only():
    now = 30 * 86400
    redis = FakeRedis({
        "app_status:u_e_g1": _entry(Status.END, 0),          # expired END  -> yes
        "app_status:u_e_g2": _entry(Status.END, now - 10),   # not expired  -> no
        "app_status:u_e_g3": _entry(Status.DOING, 0),        # not final    -> no
        "app_status:u_e_g4": _entry(Status.COMP, 0),         # expired COMP -> yes
        "app_status:u_e_g5": _entry(Status.ERROR, 0),        # expired ERR  -> yes
    })
    keys = scan_expired_final(redis, 7 * 86400, now)
    assert set(keys) == {"u_e_g1", "u_e_g4", "u_e_g5"}


def test_scan_skips_corrupt_and_missing_create_time():
    now = 30 * 86400
    redis = FakeRedis({
        "app_status:bad": "not-json",
        "app_status:noct": json.dumps({
            "user": "u", "epic": "e", "group_id": "g", "status": 2,
            "operations": [], "others": {}, "create_time": -1}),
    })
    assert scan_expired_final(redis, 7 * 86400, now) == []


def test_run_retention_deletes_files_and_redis_key(tmp_path):
    now = 30 * 86400
    src = tmp_path / "multi-fileupload"
    src.mkdir()
    (src / "u_e_g1").mkdir()
    (src / "u_e_g1" / "img.png").write_text("x", encoding="utf-8")
    redis = FakeRedis({"app_status:u_e_g1": _entry(Status.END, 0)})

    report = run_retention(redis, [str(src)], 7 * 86400, now=now)

    assert report.summary()["deleted"] == 1
    assert not (src / "u_e_g1").exists()
    assert redis.get("app_status:u_e_g1") is None


def test_run_retention_keeps_key_when_delete_fails(monkeypatch):
    now = 30 * 86400
    redis = FakeRedis({"app_status:u_e_g1": _entry(Status.END, 0)})

    import backend_tasks.retention_delete_task as task

    def boom(source_dirs, hash_key):
        raise RuntimeError("disk error")

    monkeypatch.setattr(task, "delete_hash_key_dirs", boom)
    report = run_retention(redis, ["/whatever"], 7 * 86400, now=now)

    assert report.summary()["failed"] == 1
    assert redis.get("app_status:u_e_g1") is not None  # key giữ lại để retry
