import os
import redis


def _as_bool(val, default):
    if val is None:
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "on")


def create_redis_client(conf):
    """conf(JSON) の REDIS 設定を基に redis.Redis を生成する。
    各値は環境変数で上書き可能（Docker / Azure 接続切替用）。
    """
    host = os.environ.get("REDIS_HOST", conf.redis_host)
    port = int(os.environ.get("REDIS_PORT", conf.redis_port))
    db = int(os.environ.get("REDIS_DB", conf.redis_db))
    password = os.environ.get("REDIS_PASSWORD", conf.redis_password) or None
    ssl = _as_bool(os.environ.get("REDIS_SSL"), conf.redis_ssl)

    return redis.Redis(
        host=host,
        port=port,
        db=db,
        password=password,
        ssl=ssl,
        decode_responses=True,
        socket_keepalive=True,
        health_check_interval=30,
    )
