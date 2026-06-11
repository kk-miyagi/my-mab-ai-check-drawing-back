"""Batch worker エントリポイント（Batch コンテナ用）。

Redis Streams からジョブを受け取り、対応する backend_tasks スクリプトを
サブプロセスとして実行し、結果ステータスを Redis に書き戻す。

旧構成: FastAPI プロセス内で BackgroundTasks → subprocess を起動していた。
新構成: FastAPI(api) がジョブを XADD → 本 worker(batch) が XREADGROUP で受信し実行。

実行:
    python batch_worker.py DEV    # or PROD
"""
import os
import sys
import json
import time
import socket
import subprocess
import threading

import redis

from app_config import AppConfig
from app_logger import BatchLogger
from app_redis import create_redis_client
from app_state import AppState
from app_job import JobConsumer
from state.app_status import AppStatus, Operation, Status


def _build_req_status(job, status):
    op = Operation(job["operation"], job["operation_id"], status)
    return AppStatus(
        job["user"], job["epic"], job["group_id"], status, [op], {}, -1)


def _finalize_status(app_state, job, op_status):
    """1 オペレーションのステータスを更新し、グループ全体の集約を行う。
    （旧 BackendTaskRunner.start のステータス更新ロジックと同等）
    """
    req = _build_req_status(job, op_status)
    req.group_status = op_status
    app_state.update_app_status(req)

    state_status = app_state.get_eq_app_status(req)
    if state_status is None:
        return

    if all(o.status == Status.END for o in state_status.operations):
        req.group_status = Status.END
        app_state.update_app_status(req)

    if any(o.status == Status.ERROR for o in state_status.operations):
        req.group_status = Status.ERROR
        app_state.update_app_status(req)


def run_job(app_state, job, logger, encoding):
    cmd = job["cmd"]
    doing = _build_req_status(job, Status.DOING)

    logger.log(
        doing, BatchLogger.INFO, f"**** worker start backend cmd is :{cmd} *****")

    # 受信時に DOING へ
    doing.group_status = Status.DOING
    app_state.update_app_status(doing)

    up_status = Status.END
    try:
        process = subprocess.run(
            cmd.split(' '),
            capture_output=True,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        out = process.stdout.decode(encoding, errors="replace")
        err = process.stderr.decode(encoding, errors="replace")
        for line in out.splitlines():
            logger.log(doing, BatchLogger.INFO, f"[STD-OUT] {line.strip()}")
        for line in err.splitlines():
            logger.log(doing, BatchLogger.INFO, f"[STD-ERR] {line.strip()}")

        if process.returncode == 0:
            up_status = Status.END
        else:
            up_status = Status.ERROR
            logger.log(
                doing, BatchLogger.ERROR,
                f"backend stderr:{process.returncode}")
    except Exception as e:  # noqa: BLE001
        logger.log(doing, BatchLogger.ERROR, f"backend error!!: {e}")
        up_status = Status.ERROR

    _finalize_status(app_state, job, up_status)
    logger.log(
        _build_req_status(job, up_status),
        BatchLogger.INFO,
        f"**** worker end backend cmd is :{cmd} *****")


def main():
    run_env = sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
        "RUN_ENV", "DEV")
    conf_path = './conf/conf_dev.json'
    if run_env == 'PROD':
        conf_path = './conf/conf_prod.json'

    conf = AppConfig(conf_path)
    logger = BatchLogger(conf)
    redis_client = create_redis_client(conf)
    # batch 側は FastAPI app.state を持たないため None。status は Redis 経由。
    app_state = AppState(None, threading.Lock(), conf, logger, redis_client)

    # consumer 名は replica ごとに一意にする（scale 時に pending を取り違えない）
    consumer_name = (
        os.environ.get("QUEUE_CONSUMER")
        or conf.queue_consumer
        or socket.gethostname())

    consumer = JobConsumer(
        redis_client,
        conf.queue_stream,
        conf.queue_group,
        consumer_name,
        conf.queue_block_ms,
    )

    dummy = AppStatus.get_dummy_status()
    logger.log(
        dummy, BatchLogger.INFO,
        f"BATCH WORKER START stream={conf.queue_stream} "
        f"group={conf.queue_group} consumer={consumer_name}")

    encoding = conf.batch_log_encoding or "utf-8"
    # 起動時はまず自分の pending(未ACK=クラッシュ復旧分) を処理 → 新規へ
    last_id = JobConsumer.BACKLOG_START
    try:
        while True:
            try:
                resp = consumer.read(last_id)
            except redis.exceptions.TimeoutError:
                # ブロッキング読み取りのソケットタイムアウトは正常系 → 継続
                if last_id == JobConsumer.BACKLOG_START:
                    last_id = JobConsumer.NEW_MESSAGES
                continue
            except (redis.exceptions.ConnectionError, OSError) as e:
                # Redis 一時切断（アイドルタイムアウト等）。少し待って再試行。
                logger.log(
                    dummy, BatchLogger.ERROR,
                    f"redis connection error, retrying: {e}")
                time.sleep(1)
                continue
            if not resp:
                # ">" のブロックタイムアウト
                if last_id == JobConsumer.BACKLOG_START:
                    last_id = JobConsumer.NEW_MESSAGES
                continue
            for _stream, messages in resp:
                if not messages:
                    # pending を読み切った → 新規メッセージへ
                    if last_id == JobConsumer.BACKLOG_START:
                        last_id = JobConsumer.NEW_MESSAGES
                    continue
                for msg_id, fields in messages:
                    try:
                        job = json.loads(fields["payload"])
                        run_job(app_state, job, logger, encoding)
                    except Exception as e:  # noqa: BLE001
                        logger.log(
                            dummy, BatchLogger.ERROR,
                            f"job process error msg_id={msg_id}: {e}")
                    finally:
                        consumer.ack(msg_id)
    except KeyboardInterrupt:
        logger.log(dummy, BatchLogger.INFO, "BATCH WORKER SHUTDOWN")


if __name__ == "__main__":
    main()
