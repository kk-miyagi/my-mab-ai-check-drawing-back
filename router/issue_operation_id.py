from app_router import AppRouter
from fastapi import Body
from manager.app_status_manager import AppStatus

router = AppRouter()

@router.post('/issue/operation_id/')
async def issue_operation_id(body = Body(...)):
    print(f"create app session: {AppRouter.app_session}")
    req_status = AppStatus.create_from_request(body)
    session_status = AppStatus.create_app_session(
            req_status,
            AppRouter.app_session
    )
    return router.create_responce_from_status(
            session_status
    )

