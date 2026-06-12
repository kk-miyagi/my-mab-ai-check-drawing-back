import threading
import fnmatch

from app_manager import Managers
from state.app_status import AppStatus, Status
import state_func.app_status_func as app_status_func


class _FakeConf:
    expire = 100


class _FakeRedis:
    def __init__(self):
        self.store = {}

    def get(self, k):
        return self.store.get(k)

    def set(self, k, v, ex=None):
        self.store[k] = v

    def delete(self, k):
        self.store.pop(k, None)

    def scan_iter(self, match=None):
        for k in list(self.store):
            if match is None or fnmatch.fnmatch(k, match):
                yield k


class _FakeAppState:
    def __init__(self):
        self.lock = threading.Lock()
        self.redis = _FakeRedis()
        self.conf = _FakeConf()

    def create_app_status(self):
        return app_status_func.create_app_status(self)

    def get_eq_app_status(self, req):
        return app_status_func.get_eq_app_status(self, req)

    def update_app_status(self, req):
        return app_status_func.update_app_status(self, req)

    def create_new_app_status(self, status):
        return app_status_func.create_new_app_status(self, status)


class _FakeManager:
    def __init__(self, app_state):
        self.app_state = app_state


def test_app_status_error_marks_group_status_error():
    state = _FakeAppState()
    # tồn tại sẵn group "u_e_g" với status DOING
    state.create_new_app_status(
        AppStatus("u", "e", "g", Status.DOING, [], {}, -1))

    body = {"user": "u", "epic": "e", "group_id": "g",
            "group_status": "doing", "operations": []}
    Managers().app_status_error(_FakeManager(state), body)

    stored = state.get_eq_app_status(
        AppStatus("u", "e", "g", Status.START, [], {}, -1))
    assert stored is not None
    assert stored.group_status == Status.ERROR
