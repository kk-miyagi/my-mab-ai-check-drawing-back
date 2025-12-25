from fastapi.responses import JSONResponse
from app_manager import Manager, ManagerException
from state.app_status import AppStatus


class AppStatusManager(Manager):

    NO_VALUE_ERROR = "NO_VALUE_EROOR"
    INVALID_STATUS_ERROR = "INVALID_STATUS_ERROR"

    def setup(self):
        pass

    def start(self, request, body):

        state = self.app_state

        # app_session init
        state.create_app_status()
        # status check
        req_status = AppStatus.create_from_request(body)
        if not req_status.is_not_none():
            raise ManagerException(self.NO_VALUE_ERROR)

        session_status = state.get_app_status(
                req_status
        )
        if session_status is not None:
            print(f"req status: {req_status.status}")
            print(f"session_status:{session_status.status}")
            if (
                    (req_status.status < session_status.status) or
                    (req_status.status - session_status.status > 1)):
                raise ManagerException(self.INVALID_STATUS_ERROR)

    def get_except_responce(
            self, exp, request):
        error_log = {
            "status": "",
            "message": "",
            "detail": ""
        }
        http_status = 503
        if exp.message == self.NO_VALUE_ERROR:
            error_log['message'] = "app status no value error"
            http_status = 401
        elif exp.message == self.INVALID_STATUS_ERROR:
            error_log['message'] = "invalid app status error"
            http_status = 401
        else:
            error_log['message'] = "some error app status"

        return JSONResponse(
                    content=error_log,
                    status_code=http_status)
