import sys
import logging

from retention_config import (
    load_config,
    build_redis_client,
    enqueue_retention_job,
)


def main(argv):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    env = argv[1] if len(argv) > 1 else "DEV"
    config = load_config(env)
    client = build_redis_client(config)
    msg_id = enqueue_retention_job(config, client, env)
    logging.getLogger(__name__).info("retention job enqueued id=%s", msg_id)
    return msg_id


if __name__ == "__main__":
    main(sys.argv)
