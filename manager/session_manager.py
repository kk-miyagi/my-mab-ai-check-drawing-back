import time
import uuid
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from app_manager import Manager, ManagerException
from app_logger import AppLogger


class SessionManager(Manager):

    SESSION_EXPIRE_ERROR = "SESSION_EXPIRE_ERROR"

    def setup(self):

        self.app.add_middleware(
            SessionMiddleware,
            secret_key="YOUR_SUPER_SECRET_KEY",
            max_age=None,
            https_only=False
        )
        # セッションの有効時間(秒)
        self.__SESSION_LIFETIME = 60*60

    # overload
    def child_start(self, request, body):

        logger = self.get_manager_logger()
        session = request.session

        now = time.time()

        if "session_id" not in session:
            session["session_id"] = str(uuid.uuid4())
            session["expire_time"] = now + self.__SESSION_LIFETIME
            session["count"] = 0

        if now > session["expire_time"]:
            session.clear()
            logger.log(AppLogger.ERROR, f"{self.SESSION_EXPIRE_ERROR}")
            raise ManagerException(self.SESSION_EXPIRE_ERROR)
        session["count"] += 1

    def get_child_except_responce(
            self, exp, request):
        error_log = {
            "status": "",
            "message": "",
            "detail": ""
        }

        http_status = 503
        if exp.message == self.SESSION_EXPIRE_ERROR:
            error_log['message'] = "session expire error"
            http_status = 402
        else:
            error_log['message'] = "some session error"

        return JSONResponse(
                    content=error_log,
                    status_code=http_status)
