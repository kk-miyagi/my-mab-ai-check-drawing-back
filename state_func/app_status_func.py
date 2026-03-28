import uuid
import time
from state.app_status import AppStatus


def get_all_keys(self):
    ret = None
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
        ret = status_dic.keys()
    return ret


def get_app_status(self, key):
    ret = None
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
        ret = status_dic[key]
    return ret


def create_app_status(self):
    with self.lock:
        if not hasattr(
               self.app_state,
               'APP_STATUS_SESSION_KEY'):
            self.app_state.APP_STATUS_SESSION_KEY = {}


def get_eq_app_status(self, req_status):
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
        if AppStatus._is_none_and_black(
                req_status.operation_id):
            ret = None
        elif req_status.get_hash_key() not in status_dic:
            ret = None
        else:
            ret = status_dic[req_status.get_hash_key()]
    return ret


def create_new_app_status(self, status):
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
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
        status_dic[ret.get_hash_key()] = ret
    return ret


def update_app_status(self, status):
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
        update_key = None
        for key in status_dic.keys():
            if key == status.get_hash_key():
                update_key = key
                continue
        if update_key is not None:
            state_status = status_dic[update_key]
            state_status.status = status.status
            status_dic[update_key] = state_status


def delete_app_status(self, delete_key):
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
        delete_status = None
        for key in status_dic.keys():
            if delete_key == key:
                delete_status = status_dic[key]
                continue
        if delete_status is not None:
            status_dic.pop(delete_key)
