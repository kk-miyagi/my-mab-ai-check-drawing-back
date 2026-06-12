"""Data retention 削除タスク（batch worker がサブプロセスとして実行）。

Redis の app_status:* を走査し、保持期間を過ぎ（now - create_time >
storage_expire_sec）かつ status が最終（END/COMP/ERROR）のエントリについて、
対応する画像ファイルのディレクトリを物理削除し、Redis キーも削除する。

実行: python backend_tasks/retention_delete_task.py DEV   # or PROD
"""
import os
import sys
import json
import time
import logging

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from state.app_status import AppStatus, Status          # noqa: E402
from tools.retention_delete import delete_hash_key_dirs  # noqa: E402
from app_config import AppConfig                          # noqa: E402
from app_redis import create_redis_client                # noqa: E402

logger = logging.getLogger(__name__)

PREFIX = "app_status:"
FINAL_STATUSES = (Status.END, Status.COMP, Status.ERROR)


class Report:
    def __init__(self):
        self.deleted = []
        self.failed = []

    def summary(self):
        return {"deleted": len(self.deleted), "failed": len(self.failed)}


def scan_expired_final(redis_client, expire_sec, now, prefix=PREFIX):
    """期限切れ かつ 最終ステータスの hash_key 一覧を返す。

    hash_key は Redis キー名から prefix を除いた文字列（get_hash_key() は使わない）。
    """
    hash_keys = []
    for key in redis_client.scan_iter(prefix + "*"):
        raw = redis_client.get(key)
        if raw is None:
            continue
        try:
            status = AppStatus.from_dict(json.loads(raw))
        except Exception:  # noqa: BLE001 - 壊れた JSON はスキップ
            continue
        create_time = status.create_time
        if create_time is None or create_time < 0:
            continue
        if (now - create_time) <= expire_sec:
            continue
        if status.group_status not in FINAL_STATUSES:
            continue
        hash_keys.append(key[len(prefix):])
    return hash_keys


def run_retention(redis_client, source_dirs, expire_sec, now=None,
                  prefix=PREFIX):
    if now is None:
        now = time.time()
    report = Report()
    for hk in scan_expired_final(redis_client, expire_sec, now, prefix):
        try:
            res = delete_hash_key_dirs(source_dirs, hk)
            redis_client.delete(prefix + hk)
            report.deleted.append(
                {"hash_key": hk, "deleted_count": res["deleted_count"]})
        except Exception as e:  # noqa: BLE001 - per-item isolation
            logger.exception("retention delete failed for %s", hk)
            report.failed.append({"hash_key": hk, "error": str(e)})
    return report


def main(argv):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    env = argv[1] if len(argv) > 1 else os.environ.get("RUN_ENV", "DEV")
    conf_path = './conf/conf_prod.json' if env == 'PROD' \
        else './conf/conf_dev.json'
    conf = AppConfig(conf_path)
    redis_client = create_redis_client(conf)
    report = run_retention(
        redis_client,
        conf.data_retention_source_dirs,
        conf.data_retention_storage_expire_sec,
    )
    logger.info("retention summary: %s", report.summary())
    return 1 if report.failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
