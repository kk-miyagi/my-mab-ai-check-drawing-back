from state.boot_another_process_info import BaseBootAnotherProcessInfo


def create_boot_process_info(self):
    with self.lock:
        if not hasattr(
            self.app_state,
            "BOOT_ANOTHER_PROCESS_SESSION_KEY"
        ):
            self.app_state.BOOT_ANOTHER_PROCESS_SESSION_KEY = {}


def get_boot_process_info(self, req_status):
    with self.lock:
        ret = self.app_state.BOOT_ANOTHER_PROCESS_SESSION_KEY[
            req_status.get_hash_key()
        ]
    return ret


def get_session_dict(self):
    with self.lock:
        ret = self.app_state.BOOT_ANOTHER_PROCESS_SESSION_KEY
    return ret


def update_boot_process_info(self, status):
    session_dic = self.app_state.BOOT_ANOTHER_PROCESS_SESSION_KEY
    if status.get_hash_key() not in session_dic:
        session_dic[status.get_hash_key()] = BaseBootAnotherProcessInfo(
            status.user,
            status.epic,
            status.group_id,
            status.operations[0].operation,
            status.operations[0].operation_id,
        )
    else:
        loader = session_dic[status.get_hash_key()]
        loader.group_status = status.group_status
