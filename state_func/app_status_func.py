import uuid
from state.app_status import AppStatus


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
        ret = AppStatus(
                 status.user,
                 status.epic,
                 status.operation,
                 ret_id,
                 status.status
        )
        status_dic[ret.get_hash_key()] = ret
    return ret


def update_app_status(self, status):
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
        update_status = None
        for key in status_dic.keys():
            if key == status.get_hash_key():
                update_key = key
                update_status = status
                continue
        if update_status is not None:
            status_dic[update_key] = update_status
