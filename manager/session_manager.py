import time
import uuid
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import JSONResponse
from app_manager import Manager, ManagerException


class SessionManager(Manager):

    def setup(self):

        self.app.add_middleware(
            SessionMiddleware,
            secret_key="YOUR_SUPER_SECRET_KEY",
            max_age=None,
            https_only=False
        )
        self.__SESSION_LIFETIME = 60 # セッションの有効時間(秒)

    # overload
    def start(self, request):

        session = request.session

        now = time.time()

        if "session_id" not in session:
            self.logger.debug("create session id")
            session["session_id"] = str(uuid.uuid4())
            session["expire_time"] = now + self.__SESSION_LIFETIME
            session["count"] = 0

        if now  > session["expire_time"]:
            self.logger.debug("clear session")
            session.clear()
            # TODO message
            raise ManagerException() 
        session["count"] += 1

    def get_except_response(self,exp, request):
        error_log = {
            "status": "",
            "message": "",
            "detail": ""
        }
        slef.logger.error(f"END: {log_data}")

        return JSONResponse(
                content=error_log, 
                status_code=402)
