"""Batch server entrypoint.

Subscribes to the Redis Stream produced by the FastAPI service, dispatches
each job to the matching task module, and updates the shared AppStatus in
Redis with DOING/END/ERROR so the API can report back to the client.
"""

import os
import socket
import sys
import threading
import traceback

from common.app_state import AppState
from common.config import AppConfig
from common.logger import BatchLogger
from common.queue.job_consumer import JobConsumer
from common.queue.job_schema import Job
from common.state.app_status import AppStatus, Status

from batch_server.tasks import create_label_task
from batch_server.tasks import drawing_compare_task
from batch_server.tasks import drawing_review_task
from batch_server.tasks import update_label_task


TASK_REGISTRY = {
    'create-label': create_label_task.run,
    'update-label': update_label_task.run,
    'drawing-review': drawing_review_task.run,
    'drawing-compare': drawing_compare_task.run,
}


def _load_config() -> AppConfig:
    run_env = os.environ.get('RUN_ENV', 'DEV')
    conf_dir = os.path.dirname(os.path.abspath(__file__))
    name = 'conf_prod.json' if run_env == 'PROD' else 'conf_dev.json'
    return AppConfig(os.path.join(conf_dir, 'conf', name))


def _job_to_status(job: Job, status: Status) -> AppStatus:
    return AppStatus(
        user=job.user,
        epic=job.epic,
        operation=job.operation,
        operation_id=job.operation_id,
        status=status,
        create_time=job.created_at,
    )


def _update_status(app_state: AppState, job: Job, status: Status):
    app_status = _job_to_status(job, status)
    app_state.update_app_status(app_status)


def _process(job: Job, app_state: AppState, logger: BatchLogger) -> None:
    base_status = _job_to_status(job, Status.DOING)
    handler = TASK_REGISTRY.get(job.task_type)
    if handler is None:
        logger.log(
            base_status, BatchLogger.ERROR,
            f"UNKNOWN TASK_TYPE: {job.task_type} job_id={job.job_id}")
        _update_status(app_state, job, Status.ERROR)
        return

    logger.log(
        base_status, BatchLogger.INFO,
        f"JOB START task_type={job.task_type} job_id={job.job_id}")
    _update_status(app_state, job, Status.DOING)
    try:
        handler(job.params)
    except Exception as exc:
        logger.log(
            base_status, BatchLogger.ERROR,
            f"JOB FAILED task_type={job.task_type} job_id={job.job_id}: "
            f"{exc}\n{traceback.format_exc()}")
        _update_status(app_state, job, Status.ERROR)
        return
    _update_status(app_state, job, Status.END)
    logger.log(
        base_status, BatchLogger.INFO,
        f"JOB END task_type={job.task_type} job_id={job.job_id}")


def main():
    conf = _load_config()
    logger = BatchLogger(conf)
    app_state = AppState(None, threading.Lock(), conf, logger)

    consumer_name = os.environ.get(
            'CONSUMER_NAME',
            f"{socket.gethostname()}-{os.getpid()}")
    consumer = JobConsumer(
        redis_client=app_state.redis_client,
        stream=conf.queue_stream,
        group=conf.queue_group,
        consumer_name=consumer_name,
        block_ms=conf.queue_block_ms,
    )

    logger.log(
        AppStatus.get_dummy_status(),
        BatchLogger.INFO,
        f"BATCH WORKER START stream={conf.queue_stream} "
        f"group={conf.queue_group} consumer={consumer_name}")

    try:
        for msg_id, job in consumer.iter_jobs():
            try:
                _process(job, app_state, logger)
            finally:
                consumer.ack(msg_id)
    except KeyboardInterrupt:
        logger.log(
            AppStatus.get_dummy_status(),
            BatchLogger.INFO,
            "BATCH WORKER STOPPED (KeyboardInterrupt)")
        sys.exit(0)


if __name__ == '__main__':
    main()
