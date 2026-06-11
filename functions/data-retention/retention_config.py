import os
import json

VALID_ENVS = ("DEV", "PROD")
_REQUIRED_KEYS = ("RETENTION", "REDIS", "API_BASE_URL", "API_KEY")


def config_path_for_env(env, base_dir=None):
    if base_dir is None:
        base_dir = os.path.join(os.path.dirname(__file__), "conf")
    return os.path.join(base_dir, f"retention_conf_{env.lower()}.json")


def _validate(config):
    for key in _REQUIRED_KEYS:
        if key not in config:
            raise KeyError(f"missing config key: {key}")
    if "storage_expire_sec" not in config["RETENTION"]:
        raise KeyError("missing RETENTION.storage_expire_sec")


def load_config(env, base_dir=None):
    if env not in VALID_ENVS:
        raise ValueError(
            f"invalid env: {env} (expected one of {VALID_ENVS})"
        )
    path = config_path_for_env(env, base_dir)
    with open(path, "r", encoding="utf-8") as f:
        config = json.load(f)
    _validate(config)
    return config


def build_redis_client(config):
    import redis
    r = config["REDIS"]
    return redis.Redis(
        host=r["host"],
        port=r["port"],
        password=r["password"],
        ssl=r.get("ssl", True),
        decode_responses=True,
    )


def build_post_fn(config):
    import requests

    base = config["API_BASE_URL"].rstrip("/")
    api_key = config["API_KEY"]
    url = f"{base}/api/data-retention/delete/"

    def post(hash_key):
        resp = requests.post(
            url,
            json={"hash_key": hash_key},
            headers={"X-API-Key": api_key},
            timeout=30,
        )
        return resp.status_code

    return post
