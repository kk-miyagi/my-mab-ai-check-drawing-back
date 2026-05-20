from app_router import AppRoute
from app_logger import AppLogger
from fastapi import Request, APIRouter
from state.app_status import AppStatus

router = APIRouter(prefix='/api', route_class=AppRoute)


@router.post('/status-list/')
async def status_list(request: Request):
    req_status = AppStatus.create_from_request(request.state.body)

    app_state = AppRoute.get_app_state()
    logger = app_state.getLogger()
    status_list = app_state.get_status_list(
            req_status.user,
            req_status.epic)

    logger.log(
        req_status,
        AppLogger.DEBUG,
        "status-list START"
    )
    ret_list = []
    if len(status_list) > 0:
        for status in status_list:
            ret = AppRoute.create_responce_from_status(
               status
            )
            ret_list.append(ret)
    return ret_list
