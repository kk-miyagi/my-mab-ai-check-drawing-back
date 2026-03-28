from fastapi.responses import JSONResponse
from app_manager import Manager, ManagerException
from state.app_status import AppStatus
from app_logger import AppLogger
import time


class AppStatusManager(Manager):

    NO_VALUE_ERROR = "NO_VALUE_EROOR"
    INVALID_STATUS_ERROR = "INVALID_STATUS_ERROR"

    def setup(self):
        pass

    def child_start(self, request, body):

        state = self.app_state

        # app_session init
        state.create_app_status()
        # status check
        req_status = AppStatus.create_from_request(body)
        logger = self.get_manager_logger()

        if not req_status.is_not_none():
            logger.log(
                AppLogger.ERROR,
                f"app status request no value:{self.NO_VALUE_ERROR}"
            )
            raise ManagerException(self.NO_VALUE_ERROR)

        session_status = state.get_eq_app_status(
                req_status
        )
        if session_status is not None:
            logger.log(
                AppLogger.DEBUG,
                f"request status: {req_status.status}"
            )
            logger.log(
                AppLogger.DEBUG,
                f"app session status:{session_status.status}")
            if (
                    (req_status.status) < 0 or
                    (req_status.status < session_status.status)
            ):
                logger.log(
                    AppLogger.ERROR,
                    f"app status error :{self.INVALID_STATUS_ERROR}"
                )
                raise ManagerException(self.INVALID_STATUS_ERROR)
        # expire logic
        curr_time = time.time()
        expire_time = state.getConf().expire
        for key in state.get_all_keys():
            t = state.get_app_status(key).create_time
            mess = "app status expire check start: "
            mess += f"curr:{curr_time} create:{t} expire: {expire_time}"
            logger.log(
                AppLogger.DEBUG,
                mess)
            if curr_time - t > expire_time:
                state.delete_app_status(key)
                logger.log(
                    AppLogger.INFO,
                    f"app status expired key:{key}")

    def get_child_except_responce(
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
