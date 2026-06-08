from fastapi.responses import JSONResponse
from app_manager import Manager, ManagerException
from app_logger import AppLogger


class LoginManager(Manager):

    LOGIN_EXPIRE_ERROR = "LGOIN_EXPIRE_ERROR"

    def setup(self):
        pass

    # overload
    def child_start(self, request, body):
        logger = self.get_manager_logger()

        # /login以外のリクエストの場合
        if request.url.path not in (
                '/api/login/', '/api/data-retention/delete/'):
            logger.log(AppLogger.ERROR, f"{self.LOGIN_EXPIRE_ERROR}")
            token = request.cookies.get('access_token')
            if token is None or (
                    not self.app_login.is_current_user(token[7:])):
                raise ManagerException(self.LOGIN_EXPIRE_ERROR)

    def get_child_except_responce(
            self, exp, request):
        error_log = {
            "status": "",
            "message": "",
            "detail": ""
        }

        logger = self.get_manager_logger()
        http_status = 503
        if exp.message == self.LOGIN_EXPIRE_ERROR:
            error_log['message'] = "login expire error"
            http_status = 403
        else:
            error_log['message'] = "some session error"

        logger.log(AppLogger.ERROR,
                   f"{http_status}: {self.LOGIN_EXPIRE_ERROR}")
        return JSONResponse(
                    content=error_log,
                    status_code=http_status)
