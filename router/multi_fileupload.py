from app_router import AppRouter
from fastapi import Body, UploadFile, File
from manager.app_status_manager import AppStatus, Status

router = AppRouter()

@dataclass
class MultiFileUploadManager:
    pass



@router.post('/multi_fileupload/')
async def multi_fileupload(body = Body(...),files: list[UploadFile] = File(...) ):
    req_status = AppStatus.create_from_request(body)
    
     

    return {
        "user": session_status.user,
        "epic": session_status.epic,
        "operation": session_status.operation,
        "operation_id": session_status.operation_id,
        "status": Status.status_to_str(session_status.status)
    }

