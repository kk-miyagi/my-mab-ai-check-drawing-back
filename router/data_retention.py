import hmac

from app_router import AppRoute
from app_logger import AppLogger
from fastapi.responses import JSONResponse
from fastapi import APIRouter, Request
from state.app_status import Status
from tools.retention_delete import move_hash_key_dirs

# 機械間（Azure Function）専用エンドポイント。
# 他ルーターと違い route_class=AppRoute を使わない:
# AppRoute は create_from_state で user/epic/operations 等の envelope を要求するが、
# このエンドポイントは API キー認証のみで envelope を持たないため。
router = APIRouter(prefix='/api')

_FINAL_STATUSES = (Status.ERROR, Status.END, Status.COMP)


@router.post('/data-retention/delete/')
async def delete_retention_files(request: Request):
    app_state = AppRoute.get_app_state()
    conf = app_state.getConf()
    logger = app_state.getLogger()

    api_key = request.headers.get('X-API-Key')
    if api_key is None or not hmac.compare_digest(
            api_key, conf.data_retention_api_key):
        return JSONResponse(
            status_code=401, content={"message": "invalid api key"})

    body = getattr(request.state, 'body', None) or {}
    hash_key = body.get('hash_key')
    if not hash_key:
        return JSONResponse(
            status_code=400, content={"message": "hash_key is required"})

    # safety guard: only delete data whose AppStatus is final
    status_obj = app_state.get_app_status(hash_key)
    if status_obj is None:
        return JSONResponse(
            status_code=409,
            content={"message": "app status not found",
                     "hash_key": hash_key, "moved_count": 0})
    if status_obj.status not in _FINAL_STATUSES:
        return JSONResponse(
            status_code=409,
            content={"message": "app status not final",
                     "hash_key": hash_key, "moved_count": 0})

    report = move_hash_key_dirs(
        conf.data_retention_source_dirs,
        conf.data_retention_deletion_dir,
        hash_key,
    )
    logger.log(
        status_obj, AppLogger.INFO,
        f"data-retention deleted hash_key={hash_key} "
        f"moved={report['moved_count']}")
    return JSONResponse(content=report)
