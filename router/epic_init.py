from app_router import AppRouter
from fastapi import Request
from manager.app_status_manager import Status, AppStatus

router = AppRouter()


@router.post('/epic-init/')
async def issue_operation_id(request: Request):
    req_status = AppStatus.create_from_request(request.state.body)
    session_status = None
    if req_status.status == Status.START:
        session_status = AppStatus.create_app_session(
                req_status,
                AppRouter.app_session
        )
    else:
        # update session status
        AppStatus.update_session_status(
                req_status,
                AppRouter.app_session
        )
        # get session status
        session_status = AppStatus.get_session_status(
                req_status,
                AppRouter.app_session
        )
        # TODO END session delete
    return router.create_responce_from_status(
            session_status
    )
