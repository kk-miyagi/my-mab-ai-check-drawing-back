import os
import logging

import azure.functions as func

from retention_config import load_config, build_redis_client, build_post_fn
from retention_core import run

app = func.FunctionApp()


@app.timer_trigger(
    schedule="%RETENTION_SCHEDULE%",
    arg_name="timer",
    run_on_startup=False,
    use_monitor=True,
)
def data_retention(timer: func.TimerRequest) -> None:
    env = os.environ.get("APP_ENV", "DEV")
    config = load_config(env)
    client = build_redis_client(config)
    report = run(config, client, build_post_fn(config))
    logging.info("data-retention summary: %s", report.summary())
