from app_router import AppRouter
from fastapi import Body
from manager.app_status_manager import AppStatus, Status

router = AppRouter()

@router.post('/issue/operation_id/')
async def issue_operation_id(body = Body(...)):
    print(f"create app session: {AppRouter.app_session}")
    req_status = AppStatus.create_from_request(body)
    print(req_status)
    session_status = AppStatus.create_app_session(
            req_status,
            AppRouter.app_session
    )
    return {
        "user": session_status.user,
        "epic": session_status.epic,
        "operation": session_status.operation,
        "operation_id": session_status.operation_id,
        "status": Status.status_to_str(session_status.status)
    }

