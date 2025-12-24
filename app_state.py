import uuid
from state.app_status import AppStatus
from state.multi_file_upload_info import MultiFileUploadInfo


class AppState:

    def __init__(self, app_state, lock):
        self.app_state = app_state
        self.lock = lock

    def create_app_status(self):
        with self.lock:
            if not hasattr(
                   self.app_state,
                   'APP_STATUS_SESSION_KEY'):
                self.app_state.APP_STATUS_SESSION_KEY = {}

    def get_app_status(self, req_status):
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
                print(f"update key checck session:{key}")
                print(f"update request:{status.get_hash_key()}")
                if key == status.get_hash_key():
                    update_key = key
                    update_status = status
                    continue
            if update_status is not None:
                print("upadte app session status!!")
                status_dic[update_key] = update_status

    def create_multi_fileupload_info(self):
        with self.lock:
            if not hasattr(
                self.app_state,
                'MULTI_FILE_UPLOAD_SESSION_KEY'
            ):
                self.app_state.MULTI_FILE_UPLOAD_SESSION_KEY = {}

    def get_multi_fileupload_info(self, req_status):
        with self.lock:
            ret = self.app_state.MULTI_FILE_UPLOAD_SESSION_KEY[
                    req_status.get_hash_key()
            ]
        return ret

    def update_multi_fileupload_info(self, status, file_info, sum_number=None):
        with self.lock:
            session_dic = self.app_state.MULTI_FILE_UPLOAD_SESSION_KEY
            if status.get_hash_key() not in session_dic:
                file_infos = None
                if file_info is not None:
                    file_infos = [file_info]
                session_dic[status.get_hash_key()] = MultiFileUploadInfo(
                        status.user,
                        status.epic,
                        status.operation,
                        status.operation_id,
                        status.status,
                        file_infos,
                        sum_number
                )
            else:
                info = session_dic[status.get_hash_key()]
                info.status = status.status
                if file_info is not None:
                    info.file_infos.append(file_info)
                info.sum_number = sum_number
