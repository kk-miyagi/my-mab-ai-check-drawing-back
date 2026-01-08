from app_router import AppRoute
from app_logger import AppLogger
from fastapi import Request, APIRouter
from state.app_status import Status, AppStatus

router = APIRouter(route_class=AppRoute)


@router.post('/epic-init/')
async def issue_operation_id(request: Request):
    req_status = AppStatus.create_from_request(request.state.body)
    state_status = None

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()

    if req_status.status == Status.START:
        logger.log(
            req_status,
            AppLogger.DEBUG,
            "iSSUE OPERATION-ID START STATUS"
        )
        state_status = app_state.create_new_app_state(
                req_status,
        )
    else:
        logger.log(
            req_status,
            AppLogger.DEBUG,
            f"iSSUE OPERATION-ID NOT START STATUS:{req_status.status}"
        )
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
