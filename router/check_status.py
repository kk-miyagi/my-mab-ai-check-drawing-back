from app_router import AppRoute
from app_logger import AppLogger
from fastapi import Request, APIRouter
from state.app_status import AppStatus

router = APIRouter(route_class=AppRoute)


@router.post('/check-status/')
async def issue_operation_id(request: Request):
    req_status = AppStatus.create_from_request(request.state.body)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()
    state_status = app_state.get_eq_app_status(req_status)

    logger.log(
        req_status,
        AppLogger.DEBUG,
        f"check-status START state status: {state_status}"
    )
    ret = None
    if state_status is not None:
        ret = AppRoute.create_responce_from_status(
            state_status
        )
    return ret
