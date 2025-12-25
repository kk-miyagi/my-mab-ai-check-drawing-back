from app_router import AppRouter
from fastapi import Request
from state.app_status import Status, AppStatus

router = AppRouter()


@router.post('/epic-init/')
async def issue_operation_id(request: Request):
    req_status = AppStatus.create_from_request(request.state.body)
    state_status = None
    if req_status.status == Status.START:
        state_status = router.app_state.create_new_app_state(
                req_status,
        )
    else:
        # update session status
        router.app_state.update_app_status(
                req_status
        )
        # get session status
        state_status = router.app_state.get_app_status(
                req_status
        )
        # TODO END session delete
    return router.create_responce_from_status(
            state_status
    )
