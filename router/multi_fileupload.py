from app_router import AppRouter
from fastapi import Request
from state.app_status import AppStatus, Status
from state.multi_file_upload_info import FileInfo
import os
import time

router = AppRouter()


class MultiFileUploader:
    MULTI_FILE_UPLOAD_SAVE_DIR = './multi-fileupload'

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
    # TODO operation_idがない場合はエラーにするか？
    match req_status.status:
        case Status.START:
            # TODO 一応想定外だがどうするか？
            print("START")
        case Status.DOING:
            # ファイルの保存処理
            try:
                app_state = router.app_state
                print(f"DOING:{state}")
                # multi file upload session init
                app_state.create_multi_fileupload_info()
                print("DOING upload file save!")
                file_info = await MultiFileUploader.save_multi_files(
                        req_status,
                        state
                )
                # mulit file upload session update
                print("DOING multi upload session update!")
                app_state.update_multi_fileupload_info(
                    req_status,
                    file_info
                )
                print("DOING app status session update!")
                app_state.update_app_status(
                        req_status
                )
                print("DOING create responce!")
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
                app_state = router.app_state
                print(f"END:{state}")
                # multi file upload session init
                app_state.create_multi_fileupload_info()

                upload_info = app_state.get_multi_fileupload_info(
                        req_status
                )
                if upload_info.sum_number is None:
                    # 20秒くらい待つ想定
                    WAIT_TIME = 20
                    start_time = time.time()
                    fileinfo_size = -1
                    while time.time() - start_time < WAIT_TIME:
                        if state.sum_number == len(upload_info.file_infos):
                            fileinfo_size = state.sum_number
                            break
                    if fileinfo_size > 0:
                        # multi file info update
                        app_state.update_multi_fileupload_info(
                            req_status,
                            None,
                            state.sum_number
                        )
                        # app status update
                        app_state.update_app_status(
                                req_status
                        )
                        # TODO app status session 削除(削除タイミングは考える必要があるかも）
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
