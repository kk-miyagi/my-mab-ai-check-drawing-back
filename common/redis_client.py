import redis as redis_lib
from common.config import AppConfig


def create_redis_client(conf: AppConfig):
    return redis_lib.Redis(
        host=conf.redis_host,
        port=conf.redis_port,
        password=conf.redis_password,
        ssl=conf.redis_ssl,
        decode_responses=True
    )
