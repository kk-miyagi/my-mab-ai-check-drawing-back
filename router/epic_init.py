from app_router import AppRoute
from app_logger import AppLogger
from fastapi import Request, APIRouter
from state.app_status import Status, AppStatus

router = APIRouter(prefix='/api', route_class=AppRoute)


@router.post('/epic-init/')
async def issue_operation_id(request: Request):
    req_status = AppStatus.create_from_request(request.state.body)
    state_status = None

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    if req_status.group_status == Status.START:
        logger.log(
            req_status,
            AppLogger.DEBUG,
            "epic-init START STATUS"
        )
        state_status = app_state.create_new_app_state(
                req_status,
        )
    else:
        logger.log(
            req_status,
            AppLogger.DEBUG,
            f"epic-init NOT START STATUS:{req_status.group_status}"
        )
        # update session status
        app_state.update_app_status(
                req_status
        )
        # get session status
        state_status = app_state.get_eq_app_status(
                req_status
        )
    ret = None
    if state_status is not None:
        ret = AppRoute.create_responce_from_status(
            state_status
        )
    return ret
