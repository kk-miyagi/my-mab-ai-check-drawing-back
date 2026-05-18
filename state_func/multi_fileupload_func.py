from state.multi_file_upload_info import MultiFileUploadInfo


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
                    status.group_id,
                    status.operations[0].operation,
                    status.operations[0].operation_id,
                    status.group_status,
                    file_infos,
                    sum_number
            )
        else:
            info = session_dic[status.get_hash_key()]
            info.group_status = status.group_status
            if file_info is not None:
                info.file_infos.append(file_info)
            info.sum_number = sum_number
