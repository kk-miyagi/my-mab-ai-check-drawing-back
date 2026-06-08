import json
import retention_core


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


def _status(group_status, create_time):
    return json.dumps({
        "user": "u", "epic": "e", "group_id": "g",
        "group_status": group_status, "operations": [], "others": {},
        "create_time": create_time,
    })


def _config():
    return {
        "RETENTION": {"storage_expire_sec": 7 * 86400},
        "APP_STATUS_PREFIX": "app_status",
        "TARGET_STATUSES": [-1, 2, 3],
        "DRY_RUN": False,
    }


def test_scan_returns_expired_final_only():
    now = 10 * 86400
    redis = FakeRedis({
        "app_status:u_e_g1": _status(2, 0),          # expired + END -> yes
        "app_status:u_e_g2": _status(2, 9 * 86400),  # not expired -> no
        "app_status:u_e_g3": _status(1, 0),          # DOING -> no
        "app_status:u_e_g4": _status(3, 0),          # expired + COMP -> yes
    })
    keys = retention_core.scan_expired_hash_keys(redis, _config(), now)
    assert set(keys) == {"u_e_g1", "u_e_g4"}


def test_scan_skips_missing_create_time_and_corrupt():
    now = 10 * 86400
    redis = FakeRedis({
        "app_status:u_e_g1": json.dumps({"group_status": 2}),  # no create_time
        "app_status:u_e_g2": "not-json",
    })
    assert retention_core.scan_expired_hash_keys(redis, _config(), now) == []


def test_run_classifies_responses():
    now = 10 * 86400
    redis = FakeRedis({
        "app_status:a_a_1": _status(2, 0),
        "app_status:b_b_2": _status(2, 0),
        "app_status:c_c_3": _status(2, 0),
    })
    codes = {"a_a_1": 200, "b_b_2": 409, "c_c_3": 500}
    calls = []

    def post_fn(hk):
        calls.append(hk)
        return codes[hk]

    report = retention_core.run(_config(), redis, post_fn, now=now)
    assert sorted(calls) == ["a_a_1", "b_b_2", "c_c_3"]
    assert report.deleted == ["a_a_1"]
    assert {"hash_key": "b_b_2", "reason": "api_not_final"} in report.skipped
    assert {"hash_key": "c_c_3", "error": "api_status_500"} in report.failed


def test_run_network_error_is_failed():
    now = 10 * 86400
    redis = FakeRedis({"app_status:a_a_1": _status(2, 0)})

    def post_fn(hk):
        raise RuntimeError("boom")

    report = retention_core.run(_config(), redis, post_fn, now=now)
    assert report.deleted == []
    assert report.failed[0]["hash_key"] == "a_a_1"


def test_run_dry_run_does_not_post():
    now = 10 * 86400
    redis = FakeRedis({"app_status:a_a_1": _status(2, 0)})
    cfg = _config()
    cfg["DRY_RUN"] = True
    calls = []

    report = retention_core.run(cfg, redis, lambda hk: calls.append(hk) or 200, now=now)
    assert calls == []
    assert {"hash_key": "a_a_1", "reason": "dry_run"} in report.skipped
    assert report.deleted == []
