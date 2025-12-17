import time
import uuid
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

SESSION_LIFETIME = 60 # セッションの有効時間(秒)

logger = logging.getLogger(__name__)
app = FastAPI()

@app.middleware("http")
async def middleware(request: Request, call_next):
    """
    1. セッションの確認
        - セッションが切れていれば、専用のセッションエラーレスポンスを返す
    2. 該当の処理を実行
    3. logを残す

    """
    log_data = {
        "method": request.method,
        "path": request.url.path,
        "client_ip": request.client.host
    }
    logger.info(f"START: {log_data}")

    session = request.session

    now = time.time()

    if "session_id" not in session:
        logger.debug("create session id")
        session["session_id"] = str(uuid.uuid4())
        session["expire_time"] = now + SESSION_LIFETIME
        session["count"] = 0

    if now  > session["expire_time"]:
        logger.debug("clear session")
        session.clear()
        error_log = {
            "status": "",
            "message": "",
            "detail": ""
        }
        log_data = {
            "method": request.method,
            "path": request.url.path,
            "status_code": 402,
            "client_ip": request.client.host
        }
        logger.error(f"END: {log_data}")
        return JSONResponse(content=error_log, status_code=402) # TODO: 最低限ステータスコードのみあればOK
    
    session["count"] += 1
    response = await call_next(request)

    # ログの処理
    # TODO: 以下暫定のログ
    log_data = {
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "client_ip": request.client.host
    }
    logger.info(f"END: {log_data}")

    return response

app.add_middleware(
    SessionMiddleware,
    secret_key="YOUR_SUPER_SECRET_KEY",
    max_age=None,
    https_only=False
)

@app.get("/check")
async def read_check(request: Request):
    message = {"message": "Hello World!", "user": request.session.get("session_id")}
    logger.info("API read_check")
    return JSONResponse(content=message, status_code=200)

@app.get("/")
async def root(request: Request):
    message = {"message": "Hello World!", "user": request.session.get("session_id")}
    logger.info("API root")
    return JSONResponse(content=message, status_code=200)

