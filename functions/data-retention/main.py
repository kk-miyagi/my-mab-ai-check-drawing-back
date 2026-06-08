import sys
import logging

from retention_config import load_config, build_redis_client, build_post_fn
from retention_core import run


def main(argv):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    env = argv[1] if len(argv) > 1 else "DEV"
    config = load_config(env)
    client = build_redis_client(config)
    report = run(config, client, build_post_fn(config))
    logging.getLogger(__name__).info("done: %s", report.summary())
    return report


if __name__ == "__main__":
    main(sys.argv)
