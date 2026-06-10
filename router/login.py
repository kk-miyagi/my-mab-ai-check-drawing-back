from app_router import AppRoute
from app_logger import AppLogger
from fastapi.responses import JSONResponse
from state.app_status import AppStatus
from fastapi import APIRouter, HTTPException, Request, Response, status

router = APIRouter(prefix='/api', route_class=AppRoute)


@router.post('/login/')
async def login(request: Request, response: Response):
    req_status = AppStatus.create_from_request(request.state.body)
    user_info = request.state.body.get('others')

    app_state = AppRoute.get_app_state()
    app_db = AppRoute.get_app_db()
    app_login = AppRoute.get_app_login()

    logger = app_state.getLogger()

    username = user_info['user']
    password = user_info['password']

    logger.log(
        req_status,
        AppLogger.DEBUG,
        f"login start: {username}"
    )
    if app_login.authenticate_user(
            app_db,
            username,
            password
    ):
        ret = AppRoute.create_responce_from_status(
                req_status
        )
        # JWT token set cookie
        ret = app_login.set_token_with_cookie(
                {'sub': username},
                JSONResponse(content=ret)
        )
    else:
        # TODO log and status
        raise HTTPException(
                  status_code=status.HTTP_401_UNAUTHORIZED,
                  detail="User not found"
        )
    return ret
