import uuid
import time
import json
<<<<<<< HEAD
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
=======
from state.app_status import AppStatus
from state.app_status import Operation
>>>>>>> f99d355 (build docker container separate backend_task (such as batch server) and fastapi server)


# Redis キープレフィックス（CLAUDE.md の app_status: に準拠）
_PREFIX = "app_status:"


def _key(hash_key):
    return _PREFIX + hash_key


def _ttl(self):
    # conf_*.json:APP_STATUS.expire（秒）。Redis が期限切れを自動削除する。
    return int(self.conf.expire)


def _load(self, hash_key):
    raw = self.redis.get(_key(hash_key))
    if raw is None:
        return None
    return AppStatus.from_dict(json.loads(raw))


def _save(self, status):
    self.redis.set(
        _key(status.get_hash_key()),
        json.dumps(status.to_dict()),
        ex=_ttl(self),
    )


def get_all_keys(self):
<<<<<<< HEAD
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
=======
    # 旧実装と同様に hash_key（プレフィックス無し）のリストを返す
    return [k[len(_PREFIX):] for k in self.redis.scan_iter(match=_PREFIX + "*")]


def get_app_status(self, key):
    return _load(self, key)


def create_app_status(self):
    # Redis バックエンドでは初期化不要（互換のため残置）
>>>>>>> f99d355 (build docker container separate backend_task (such as batch server) and fastapi server)
    pass


def get_status_list(self, user, epic):
    ret_list = []
<<<<<<< HEAD
    for k in self.redis_client.scan_iter(f"{_PREFIX}:*"):
        data = self.redis_client.get(k)
        if data is not None:
            status = _deserialize(data)
            if status.user == user and status.epic == epic:
                ret_list.append(status)
=======
    for k in self.redis.scan_iter(match=_PREFIX + "*"):
        raw = self.redis.get(k)
        if raw is None:
            continue
        val = AppStatus.from_dict(json.loads(raw))
        if val.user == user and val.epic == epic:
            ret_list.append(val)
>>>>>>> f99d355 (build docker container separate backend_task (such as batch server) and fastapi server)
    return ret_list


def get_eq_app_status(self, req_status):
<<<<<<< HEAD
    if AppStatus._is_none_and_black(req_status.operation_id):
        return None
    data = self.redis_client.get(_key(req_status.get_hash_key()))
    if data is None:
        return None
    return _deserialize(data)


def create_new_app_status(self, status):
    ret_id = status.operation_id
    if AppStatus._is_none_and_black(ret_id):
=======
    if AppStatus._is_none_and_black(req_status.group_id):
        return None
    return _load(self, req_status.get_hash_key())


def create_new_app_status(self, status):
    ret_id = status.group_id
    if ret_id == 'init' or AppStatus._is_none_and_black(ret_id):
>>>>>>> f99d355 (build docker container separate backend_task (such as batch server) and fastapi server)
        ret_id = str(uuid.uuid4())
    ret_time = time.time()
    ret = AppStatus(
        status.user,
        status.epic,
<<<<<<< HEAD
        status.operation,
        ret_id,
        status.status,
        ret_time
    )
    self.redis_client.setex(_key(ret.get_hash_key()), self.conf.expire, _serialize(ret))
=======
        ret_id,
        status.group_status,
        [],
        {},
        ret_time,
    )
    _save(self, ret)
    return ret


def create_new_ope_id(self, status):
    with self.lock:
        state_status = _load(self, status.get_hash_key())
        if state_status is None:
            return None
        n_opes = []
        for ope in status.operations:
            n_opes.append(
                Operation(ope.operation, str(uuid.uuid4()), ope.status))
        ret_opes = state_status.operations + n_opes
        ret = AppStatus(
            state_status.user,
            state_status.epic,
            state_status.group_id,
            state_status.group_status,
            ret_opes,
            status.others,
            state_status.create_time,
        )
        _save(self, ret)
>>>>>>> f99d355 (build docker container separate backend_task (such as batch server) and fastapi server)
    return ret


def update_app_status(self, status):
<<<<<<< HEAD
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
=======
    with self.lock:
        state_status = _load(self, status.get_hash_key())
        if state_status is None:
            return
        state_status.group_status = status.group_status
        for ope in status.operations:
            for state_op in state_status.operations:
                if str(state_op.operation_id) == str(ope.operation_id):
                    state_op.operation = ope.operation
                    state_op.status = ope.status

        for k in (status.others or {}).keys():
            state_status.others[k] = status.others[k]

        _save(self, state_status)


def delete_app_status(self, delete_key):
    self.redis.delete(_key(delete_key))
>>>>>>> f99d355 (build docker container separate backend_task (such as batch server) and fastapi server)
