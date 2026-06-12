import threading
import fnmatch

from state.app_status import AppStatus, Operation, Status
import state_func.app_status_func as app_status_func


def _sys_status():
    # mirrors batch_worker._build_req_status for the SYSTEM retention job
    return AppStatus("SYSTEM", "SYSTEM", "SYSTEM", Status.DOING,
                     [Operation("retention", "-1", Status.DOING)], {}, -1)


# --- get_hash_key is group-based: user_epic_group_id ------------------------

def test_get_hash_key_is_group_based():
    s = AppStatus("u", "e", "g", Status.END,
                  [Operation("op", "oid", Status.END)], {}, 0)
    assert s.get_hash_key() == "u_e_g"


def test_get_hash_key_ignores_operations():
    # Khác operations nhưng cùng group -> cùng key (key theo group, không theo op).
    with_ops = AppStatus("u", "e", "g", Status.END,
                         [Operation("X", "Y", Status.END)], {}, 0)
    no_ops = AppStatus("u", "e", "g", Status.START, [], {}, 0)
    assert with_ops.get_hash_key() == "u_e_g"
    assert no_ops.get_hash_key() == "u_e_g"


def test_dummy_and_system_hash_key():
    assert AppStatus.get_dummy_status().get_hash_key() == "SYSTEM_SYSTEM_SYSTEM"
    assert _sys_status().get_hash_key() == "SYSTEM_SYSTEM_SYSTEM"


# --- is_not_none validates the key-forming fields ---------------------------

def test_is_not_none_requires_user_epic_group():
    ok = AppStatus("u", "e", "g", Status.END, [], {}, 0)
    no_group = AppStatus("u", "e", "", Status.END,
                         [Operation("op", "oid", Status.END)], {}, 0)
    assert ok.is_not_none() is True
    assert no_group.is_not_none() is False


# --- save/load symmetry: the actual bug being fixed -------------------------

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


class _FakeState:
    def __init__(self):
        self.lock = threading.Lock()
        self.redis = _FakeRedis()
        self.conf = _FakeConf()


def test_create_with_empty_ops_then_load_with_ops_hits_same_key():
    # issue/group-id lưu group với operations=[]; request sau mang group_id +
    # operations phải resolve ĐÚNG key đã lưu (trước fix: trả None do key lệch).
    state = _FakeState()
    created = app_status_func.create_new_app_status(
        state, AppStatus("u", "e", "g", Status.START, [], {}, -1))
    assert created.get_hash_key() == "u_e_g"
    assert "app_status:u_e_g" in state.redis.store

    req = AppStatus("u", "e", "g", Status.DOING,
                    [Operation("op", "oid", Status.DOING)], {}, -1)
    loaded = app_status_func.get_eq_app_status(state, req)
    assert loaded is not None          # bug cũ: None vì save/load khác key
    assert loaded.group_id == "g"


def test_update_app_status_noop_when_key_missing():
    # SYSTEM retention job: update với key không tồn tại -> no-op, không raise.
    state = _FakeState()
    app_status_func.update_app_status(state, _sys_status())
    assert "app_status:SYSTEM_SYSTEM_SYSTEM" not in state.redis.store
