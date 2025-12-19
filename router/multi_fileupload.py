from app_router import AppRouter
from fastapi import Body, UploadFile, File
from manager.app_status_manager import AppStatus, Status
import dataclass

router = AppRouter()

@dataclass
class MultiFileUploadInfo:

    @dataclass
    class FileInfo:
        operation_id: str
        branch: int
        file_name: str
        save_path: str

    MULTI_FILE_UPLOAD_SESSION_KEY = "MULTI_FILE_UPLOAD_SESSION_KEY"
    user: str
    epic: str
    operation: str
    operation_id: str
    status: str
    file_infos: List[FileInfo]
    all_num: int

    @classmethod
    def get_multi_fileupload_info(cls, req_status, session_app):
        if cls.MULTI_FILE_UPLOAD_SESSION_KEY not in session_app:
            session_app[cls.MULTI_FILE_UPLOAD_SESSION_KEY] = {} 
        # TODO

    def get_hash_key(self):



@router.post('/multi_fileupload/')
async def multi_fileupload(body = Body(...),files: list[UploadFile] = File(...)):
    print(f"body: {body}/ file num: {len(files)}")
    ret = None
    req_status = AppStatus.create_from_request(body)
    match req_staus:
        case Status.START:
            # TODO 一応想定外だがどうするか？
        case Status.DOING:
            # ファイルの保存処理
            # fileuploadinfoの更新
        case Status.END:
            # fileuploadinfoの確認
            # 20秒くらい待つ想定
            # fileuploadinfoの更新
    return ret
