import os
import json

VALID_ENVS = ("DEV", "PROD")
_REQUIRED_KEYS = ("REDIS", "QUEUE")


def config_path_for_env(env, base_dir=None):
    if base_dir is None:
        base_dir = os.path.join(os.path.dirname(__file__), "conf")
    return os.path.join(base_dir, f"retention_conf_{env.lower()}.json")


def _validate(config):
    for key in _REQUIRED_KEYS:
        if key not in config:
            raise KeyError(f"missing config key: {key}")
    if "stream" not in config["QUEUE"]:
        raise KeyError("missing QUEUE.stream")


def load_config(env, base_dir=None):
    if env not in VALID_ENVS:
        raise ValueError(
            f"invalid env: {env} (expected one of {VALID_ENVS})")
    path = config_path_for_env(env, base_dir)
    with open(path, "r", encoding="utf-8") as f:
        config = json.load(f)
    _validate(config)
    return config


def _as_bool(val, default):
    # 空文字（REDIS_SSL= のような明示空）は「未設定」として default を採用する。
    if val is None or str(val).strip() == "":
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "on")


def build_redis_client(config):
    """REDIS 設定から redis.Redis を生成。各値は環境変数で上書き可能
    （app 本体 app_redis.create_redis_client と同じ規約。docker-compose では
    REDIS_HOST=redis 等で in-cluster の Redis に接続する）。"""
    import redis
    r = config.get("REDIS", {})
    host = os.environ.get("REDIS_HOST", r.get("host"))
    port = int(os.environ.get("REDIS_PORT", r.get("port", 6379)))
    # 空 or 未設定の REDIS_PASSWORD は「上書きしない」として conf 値へフォールバック
    # （明示空文字で設定済みパスワードを誤ってクリアしないため）。
    _pw_env = os.environ.get("REDIS_PASSWORD")
    password = (_pw_env if _pw_env else r.get("password", "")) or None
    ssl = _as_bool(os.environ.get("REDIS_SSL"), r.get("ssl", True))
    db = int(os.environ.get("REDIS_DB", r.get("db", 0)))
    return redis.Redis(
        host=host,
        port=port,
        db=db,
        password=password,
        ssl=ssl,
        decode_responses=True,
    )


def build_job(env):
    """batch_worker が消費するジョブ payload（SYSTEM envelope）。"""
    return {
        "cmd": f"python backend_tasks/retention_delete_task.py {env}",
        "user": "SYSTEM",
        "epic": "SYSTEM",
        "group_id": "SYSTEM",
        "operation": "retention",
        "operation_id": "-1",
    }


def enqueue_retention_job(config, redis_client, env):
    """retention 削除ジョブを Redis Streams へ XADD する。"""
    stream = config["QUEUE"]["stream"]
    return redis_client.xadd(
        stream, {"payload": json.dumps(build_job(env))})
