from app_router import AppRoute
from fastapi import Request
from fastapi import APIRouter
from state.app_status import AppStatus

router = APIRouter(prefix='/api', route_class=AppRoute)


@router.post('/issue/operation-id/')
async def issue_operation_id(request: Request):
    req_status = AppStatus.create_from_request(request.state.body)
    app_state = AppRoute.get_app_state()
    new_status = app_state.create_new_ope_id(
            req_status,
    )
    return AppRoute.create_responce_from_status(
        new_status
    )
