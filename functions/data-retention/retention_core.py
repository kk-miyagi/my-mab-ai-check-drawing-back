import json
import time
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Mirror state.app_status.Status of the main app.
STATUS_ERROR = -1
STATUS_END = 2
STATUS_COMP = 3
DEFAULT_TARGET_STATUSES = (STATUS_ERROR, STATUS_END, STATUS_COMP)


@dataclass
class Report:
    deleted: list = field(default_factory=list)
    skipped: list = field(default_factory=list)
    failed: list = field(default_factory=list)

    def summary(self):
        return {
            "deleted": len(self.deleted),
            "skipped": len(self.skipped),
            "failed": len(self.failed),
        }


def _strip_prefix(key, prefix):
    return key[len(prefix) + 1:]


def scan_expired_hash_keys(redis_client, config, now):
    prefix = config.get("APP_STATUS_PREFIX", "app_status")
    expire_sec = config["RETENTION"]["storage_expire_sec"]
    target = set(config.get("TARGET_STATUSES", DEFAULT_TARGET_STATUSES))
    hash_keys = []
    for key in redis_client.scan_iter(f"{prefix}:*"):
        data = redis_client.get(key)
        if data is None:
            continue
        try:
            d = json.loads(data)
        except (ValueError, TypeError):
            continue
        create_time = d.get("create_time")
        if create_time is None or (now - create_time) <= expire_sec:
            continue
        if d.get("group_status") not in target:
            continue
        hash_keys.append(_strip_prefix(key, prefix))
    return hash_keys


def run(config, redis_client, post_fn, now=None):
    if now is None:
        now = time.time()
    dry_run = config.get("DRY_RUN", False)
    report = Report()
    for hk in scan_expired_hash_keys(redis_client, config, now):
        if dry_run:
            report.skipped.append({"hash_key": hk, "reason": "dry_run"})
            continue
        try:
            code = post_fn(hk)
        except Exception as e:  # noqa: BLE001 - per-item isolation
            logger.exception("delete request error for %s", hk)
            report.failed.append({"hash_key": hk, "error": str(e)})
            continue
        if 200 <= code < 300:
            report.deleted.append(hk)
        elif code == 409:
            report.skipped.append({"hash_key": hk, "reason": "api_not_final"})
        else:
            report.failed.append(
                {"hash_key": hk, "error": f"api_status_{code}"})
    logger.info("retention summary: %s", report.summary())
    return report
