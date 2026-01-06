from app_router import AppRoute
from fastapi import Request, APIRouter
from state.app_status import Status, AppStatus

router = APIRouter(route_class=AppRoute)


@router.post('/epic-init/')
async def issue_operation_id(request: Request):
    req_status = AppStatus.create_from_request(request.state.body)
    state_status = None
    app_state = AppRoute.get_app_state()
    if req_status.status == Status.START:
        state_status = app_state.create_new_app_state(
                req_status,
        )
    else:
        # update session status
        app_state.update_app_status(
                req_status
        )
        # get session status
        state_status = app_state.get_app_status(
                req_status
        )
        # TODO END session delete
    return AppRoute.create_responce_from_status(
            state_status
    )
