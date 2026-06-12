import retention_config


class _Captured:
    kwargs = None


class _FakeRedis:
    def __init__(self, **kwargs):
        _Captured.kwargs = kwargs


def _patch_redis(monkeypatch):
    import redis
    _Captured.kwargs = None
    monkeypatch.setattr(redis, "Redis", _FakeRedis)


def _clear_env(monkeypatch):
    for k in ("REDIS_HOST", "REDIS_PORT", "REDIS_SSL",
              "REDIS_PASSWORD", "REDIS_DB"):
        monkeypatch.delenv(k, raising=False)


_CFG = {"REDIS": {"host": "azure.example", "port": 6380,
                  "password": "secret", "ssl": True}}


def test_build_redis_client_prefers_env_overrides(monkeypatch):
    _patch_redis(monkeypatch)
    _clear_env(monkeypatch)
    monkeypatch.setenv("REDIS_HOST", "redis")
    monkeypatch.setenv("REDIS_PORT", "6379")
    monkeypatch.setenv("REDIS_SSL", "false")
    monkeypatch.setenv("REDIS_PASSWORD", "redis-pw")
    monkeypatch.setenv("REDIS_DB", "2")
    retention_config.build_redis_client(_CFG)
    assert _Captured.kwargs["host"] == "redis"
    assert _Captured.kwargs["port"] == 6379
    assert _Captured.kwargs["ssl"] is False
    assert _Captured.kwargs["password"] == "redis-pw"
    assert _Captured.kwargs["db"] == 2


def test_build_redis_client_falls_back_to_config(monkeypatch):
    _patch_redis(monkeypatch)
    _clear_env(monkeypatch)
    retention_config.build_redis_client(_CFG)
    assert _Captured.kwargs["host"] == "azure.example"
    assert _Captured.kwargs["port"] == 6380
    assert _Captured.kwargs["ssl"] is True
    assert _Captured.kwargs["password"] == "secret"
    assert _Captured.kwargs["db"] == 0


def test_empty_password_env_does_not_clear_configured_password(monkeypatch):
    # REDIS_PASSWORD="" phải coi là "không override" -> dùng password trong conf,
    # tránh vô tình xóa auth đã cấu hình.
    _patch_redis(monkeypatch)
    _clear_env(monkeypatch)
    monkeypatch.setenv("REDIS_PASSWORD", "")
    retention_config.build_redis_client(_CFG)
    assert _Captured.kwargs["password"] == "secret"


def test_empty_password_everywhere_yields_none(monkeypatch):
    _patch_redis(monkeypatch)
    _clear_env(monkeypatch)
    cfg = {"REDIS": {"host": "h", "port": 6379, "password": "", "ssl": False}}
    retention_config.build_redis_client(cfg)
    assert _Captured.kwargs["password"] is None
