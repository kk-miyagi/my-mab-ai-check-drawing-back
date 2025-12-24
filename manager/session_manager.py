import time
import uuid
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import JSONResponse
from app_manager import Manager, ManagerException


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
        self.__SESSION_LIFETIME = 60

    # overload
    def start(self, request, body, app_session):

        session = request.session

        now = time.time()

        if "session_id" not in session:
            self.logger.debug("create session id")
            session["session_id"] = str(uuid.uuid4())
            session["expire_time"] = now + self.__SESSION_LIFETIME
            session["count"] = 0

        if now > session["expire_time"]:
            self.logger.debug("clear session")
            session.clear()
            raise ManagerException(self.SESSION_EXPIRE_ERROR)
        session["count"] += 1

    def get_except_responce(
            self, exp, request, app_session):
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

        # TODO ERROR LOG
        self.logger.error(f"END: {error_log['message']}")
        return JSONResponse(
                content=error_log,
                status_code=http_status)
