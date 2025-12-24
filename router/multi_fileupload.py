from app_router import AppRouter
from fastapi import Request
from manager.app_status_manager import AppStatus, Status
from dataclasses import dataclass
import os
import time

router = AppRouter()


@dataclass
class FileInfo:
    save_paths: list[str]
    filenames: list[str]
    file_contents: list[str]
    number: str


@dataclass
class MultiFileUploader:

    MULTI_FILE_UPLOAD_SESSION_KEY = "MULTI_FILE_UPLOAD_SESSION_KEY"
    MULTI_FILE_UPLOAD_SAVE_DIR = './multi-fileupload'
    user: str
    epic: str
    operation: str
    operation_id: str
    status: str
    file_infos: list[FileInfo]
    sum_number: int

    @classmethod
    def get_multi_fileuploader(cls, req_status, session_app):
        if cls.MULTI_FILE_UPLOAD_SESSION_KEY not in session_app:
            session_app[cls.MULTI_FILE_UPLOAD_SESSION_KEY] = {}

        return session_app[cls.MULTI_FILE_UPLOAD_SESSION_KEY][
                req_status.get_hash_key()
        ]

    @classmethod
    def create_multi_fileuploder_session(cls, session_app):
        if cls.MULTI_FILE_UPLOAD_SESSION_KEY not in session_app:
            session_app[cls.MULTI_FILE_UPLOAD_SESSION_KEY] = {}

    @classmethod
    def upadte_muliti_fileuploder_session(
            cls, status, file_info, session_app, sum_number=None):
        session_dic = session_app[cls.MULTI_FILE_UPLOAD_SESSION_KEY]
        if status.get_hash_key() not in session_dic:
            file_infos = None
            if file_info is not None:
                file_infos = [file_info]
            session_dic[status.get_hash_key()] = MultiFileUploader(
                    status.user,
                    status.epic,
                    status.operation,
                    status.operation_id,
                    status.status,
                    file_infos,
                    sum_number
            )
        else:
            loader = session_dic[status.get_hash_key()]
            loader.status = status.status
            if file_info is not None:
                loader.file_infos.append(file_info)
            loader.sum_number = sum_number

    @classmethod
    async def save_multi_files(cls, req_status, state) -> FileInfo:
        file_info = None
        files_dic = {
                'bf_file': state.bf_file,
                'af_file': state.af_file,
                'bf_file_csv': state.bf_file_csv,
                'af_file_csv': state.af_file_csv,
        }
        save_paths = []
        filenames = []
        file_contents = []
        print(f"DOING file keys:{files_dic.keys()}")
        for file_key in files_dic.keys():
            file = files_dic[file_key]
            if file is not None:
                content = await file.read()
                save_path = f"{MultiFileUploader.MULTI_FILE_UPLOAD_SAVE_DIR}"
                save_path += f"/{req_status.get_hash_key()}"
                file_name = f"{save_path}/"
                file_name += f"{state.number}_{file_key}_{file.filename}"

                os.makedirs(save_path, exist_ok=True)
                save_paths.append(save_path)
                filenames.append(file_name)
                file_contents.append(file.content_type)
                with open(file_name, 'wb') as f:
                    f.write(content)
        if (
                len(save_paths) > 0 and
                (len(save_paths) == len(filenames))):
            file_info = FileInfo(
                    save_paths,
                    filenames, file_contents, state.number)
        return file_info

    def get_hash_key(self):
        return '_'.join([
            self.user,
            self.epic,
            self.operation,
            self.operation_id
        ])


@router.post('/multi-fileupload/')
async def multi_fileupload(request: Request):
    ret = None
    state = request.state
    req_status = AppStatus.create_from_state(state)
    print(f"req_status: {req_status}")
    match req_status.status:
        case Status.START:
            # TODO 一応想定外だがどうするか？
            print("START")
        case Status.DOING:
            # ファイルの保存処理
            try:
                print(f"DOING:{state}")
                # multi file upload session init
                MultiFileUploader.create_multi_fileuploder_session(
                        router.app_session
                )
                print("DOING upload file save!")
                file_info = await MultiFileUploader.save_multi_files(
                        req_status,
                        state
                )
                # mulit file upload session update
                print("DOING multi upload session update!")
                MultiFileUploader.upadte_muliti_fileuploder_session(
                    req_status,
                    file_info,
                    router.app_session
                )
                print("DOING app status session update!")
                AppStatus.update_session_status(
                        req_status,
                        router.app_session
                )
                print("DOING app session update!")
                ret = router.create_responce_from_status(
                    req_status
                )
                ret['number'] = request.state.number

            except Exception as e:
                # TODO error handoling
                raise e

        case Status.END:
            try:
                ret = None
                print("END")
                MultiFileUploader.create_multi_fileuploder_session(
                        router.app_session
                )
                uploader_info = MultiFileUploader.get_multi_fileuploader(
                        req_status,
                        router.app_session
                )
                if uploader_info.sum_number is None:
                    # 20秒くらい待つ想定
                    WAIT_TIME = 20
                    start_time = time.time()
                    fileinfo_size = -1
                    while time.time() - start_time < WAIT_TIME:
                        if state.sum_number == len(uploader_info.file_infos):
                            fileinfo_size = state.sum_number
                            break
                    if fileinfo_size > 0:
                        # multi file info update
                        MultiFileUploader.upadte_muliti_fileuploder_session(
                            req_status,
                            None,
                            router.app_session,
                            state.sum_number
                        )
                        # app status update
                        AppStatus.update_session_status(
                                req_status,
                                router.app_session
                        )
                else:
                    # 既にsum_numberが更新されている場合は何もしない
                    # TODO logs
                    pass
                ret = router.create_responce_from_status(
                    req_status
                )
                ret['sum_number'] = request.state.sum_number
            except Exception as e:
                # TODO error handling
                raise e

    return ret
