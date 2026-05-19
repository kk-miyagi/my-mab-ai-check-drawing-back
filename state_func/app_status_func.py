import uuid
import time
from state.app_status import AppStatus
from state.app_status import Operation


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


def get_status_list(self, user, epic):
    ret_list = []
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
        for val in status_dic.values():
            if val.user == user and val.epic == user:
                ret_list.append(val)
    return ret_list


def get_eq_app_status(self, req_status):
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
        if AppStatus._is_none_and_black(req_status.group_id):
            ret = None
        elif req_status.get_hash_key() not in status_dic:
            ret = None
        else:
            ret = status_dic[req_status.get_hash_key()]
    return ret


def create_new_app_status(self, status):
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
        ret_id = status.group_id
        if AppStatus._is_none_and_black(ret_id):
            ret_id = str(uuid.uuid4())
        ret_time = time.time()
        ret = AppStatus(
                 status.user,
                 status.epic,
                 ret_id,
                 status.group_status,
                 [],
                 {},
                 ret_time
        )
        status_dic[ret.get_hash_key()] = ret
    return ret


def create_new_ope_id(self, status):
    with self.lock:
        status_dic = self.app_state.APP_STATUS_SESSION_KEY
        state_status = status_dic[status.get_hash_key()]
        opes = status.operations
        ret = None
        n_opes = []
        for ope in opes:
            n_ope = Operation(
                        ope.operation,
                        uuid.uuid4(),
                        ope.status
            )
            n_opes.append(n_ope)
        ret_opes = state_status.operations + n_opes
        ret = AppStatus(
            state_status.user,
            state_status.epic,
            state_status.group_id,
            state_status.group_status,
            ret_opes,
            state_status.others,
            state_status.create_time
        )
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
            state_status.group_status = status.group_status
            for ope in status.operations:
                for state_op in state_status.operations:
                    if (
                            state_op.operation == ope.operation
                            ) and (state_op.operation_id == ope.operation_id):
                        state_op.group_status = ope.group_status

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
