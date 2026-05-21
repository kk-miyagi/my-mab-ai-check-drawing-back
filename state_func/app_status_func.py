import uuid
import time
import json
import dataclasses
from state.app_status import AppStatus, Status

_PREFIX = "app_status"


def _key(hash_key: str) -> str:
    return f"{_PREFIX}:{hash_key}"


def _serialize(status: AppStatus) -> str:
    d = dataclasses.asdict(status)
    return json.dumps(d)


def _deserialize(data: str) -> AppStatus:
    d = json.loads(data)
    return AppStatus(
        user=d['user'],
        epic=d['epic'],
        operation=d['operation'],
        operation_id=d['operation_id'],
        status=Status(d['status']),
        create_time=d['create_time']
    )


def get_all_keys(self):
    keys = []
    for k in self.redis_client.scan_iter(f"{_PREFIX}:*"):
        keys.append(k[len(_PREFIX) + 1:])
    return keys


def get_app_status(self, key):
    data = self.redis_client.get(_key(key))
    if data is None:
        return None
    return _deserialize(data)


def create_app_status(self):
    pass


def get_status_list(self, user, epic):
    ret_list = []
    for k in self.redis_client.scan_iter(f"{_PREFIX}:*"):
        data = self.redis_client.get(k)
        if data is not None:
            status = _deserialize(data)
            if status.user == user and status.epic == epic:
                ret_list.append(status)
    return ret_list


def get_eq_app_status(self, req_status):
    if AppStatus._is_none_and_black(req_status.operation_id):
        return None
    data = self.redis_client.get(_key(req_status.get_hash_key()))
    if data is None:
        return None
    return _deserialize(data)


def create_new_app_status(self, status):
    ret_id = status.operation_id
    if AppStatus._is_none_and_black(ret_id):
        ret_id = str(uuid.uuid4())
    ret_time = time.time()
    ret = AppStatus(
        status.user,
        status.epic,
        status.operation,
        ret_id,
        status.status,
        ret_time
    )
    self.redis_client.setex(_key(ret.get_hash_key()), self.conf.expire, _serialize(ret))
    return ret


def update_app_status(self, status):
    k = _key(status.get_hash_key())
    data = self.redis_client.get(k)
    if data is None:
        return
    state_status = _deserialize(data)
    state_status.status = status.status
    ttl = self.redis_client.ttl(k)
    expire = ttl if ttl > 0 else self.conf.expire
    self.redis_client.setex(k, expire, _serialize(state_status))


def delete_app_status(self, delete_key):
    self.redis_client.delete(_key(delete_key))
