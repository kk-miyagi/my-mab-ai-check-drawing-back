import json
import dataclasses
from state.boot_another_process_info import BaseBootAnotherProcessInfo

_PREFIX = "boot_another_process"


def _key(hash_key: str) -> str:
    return f"{_PREFIX}:{hash_key}"


def _serialize(info: BaseBootAnotherProcessInfo) -> str:
    return json.dumps(dataclasses.asdict(info))


def _deserialize(data: str) -> BaseBootAnotherProcessInfo:
    d = json.loads(data)
    return BaseBootAnotherProcessInfo(
        user=d.user,
        epic=d.epic,
        group_id=d.group_id,
        operation=d.operations[0].operation,
        operation_id=d.operations[0].operation_id
    )


def create_boot_process_info(self):
    pass


def get_boot_process_info(self, req_status):
    data = self.redis_client.get(_key(req_status.get_hash_key()))
    if data is None:
        return None
    return _deserialize(data)


def get_session_dict(self):
    result = {}
    for k in self.redis_client.scan_iter(f"{_PREFIX}:*"):
        data = self.redis_client.get(k)
        if data is not None:
            hash_key = k[len(_PREFIX) + 1:]
            result[hash_key] = _deserialize(data)
    return result


def update_boot_process_info(self, status):
    k = _key(status.get_hash_key())
    data = self.redis_client.get(k)
    if data is None:
        info = BaseBootAnotherProcessInfo(
            status.user,
            status.epic,
            status.group_id,
            status.operations[0].operation,
            status.operations[0].operation_id,
        )
    else:
        info = _deserialize(data)
        info.status = status.status
    ttl = self.redis_client.ttl(k)
    expire = ttl if ttl > 0 else self.conf.expire
    self.redis_client.setex(k, expire, _serialize(info))
