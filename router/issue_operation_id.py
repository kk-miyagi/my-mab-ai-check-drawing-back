from app_router import AppRouter
from fastapi import Request
from state.app_status import AppStatus

router = AppRouter()


@router.post('/issue/operation-id/')
async def issue_operation_id(request: Request):
    req_status = AppStatus.create_from_request(request.state.body)
    state_status = router.app_state.create_new_app_status(
            req_status,
    )
    return router.create_responce_from_status(
            state_status
    )
