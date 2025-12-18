from fastapi.responses import JSONResponse
from app_manager import Manager, ManagerException
from dataclasses import dataclass
from enum import IntEnum
import uuid as uu
import json

class Status(IntEnum):
    START = 0
    DOING = 1
    END = 2
    
    @classmethod
    def str_to_status(cls, mess):
        ret = None
        if mess == "start":
            ret = Status.START
        elif mess == "doing":
            ret = Status.DOING
        elif mess == "end":
            ret = Status.END 
        return ret
    
    @classmethod
    def status_to_str(cls, status):
        ret = None
        if status == Status.START:
            ret = "start"
        elif status == Status.DOING:
            ret = "doing"
        elif status == Status.END:
            ret = "end"
        return ret


@dataclass
class AppStatus:
    user: str
    epic: str
    operation: str
    operation_id: str
    status: Status 
    APP_STATUS_SESSION_KEY = "APP_STATUS_SESSION_KEY"
    APP_STATUS_USER = "user"
    APP_STATUS_EPIC = "epic"
    APP_STATUS_OPE = "operation"
    APP_STATUS_OPE_ID = "operation_id"
    APP_STATUS_STATUS = "status"

    @classmethod
    def create_app_session(cls, status, app_session):
        if status.status != Status.START:
            raise ValueError()
        if cls.APP_STATUS_SESSION_KEY not in app_session:
            app_session[cls.APP_STATUS_SESSION_KEY] = []

        status_list = app_session[cls.APP_STATUS_SESSION_KEY]
        ret = AppStatus(
                status.user,
                status.epic,
                status.operation,
                str(uu.uuid4()),
                status.status
        ) 
        status_list.append(ret)
        return ret

    @classmethod
    def delete_app_session(cls, status, app_session):
        if cls.APP_STATUS_SESSION_KEY not in spp_session:
            raise ValueError()
        status_list = app_session[cls.APP_STATUS_SESSION_KEY]
        eq_idxs = [i for i, s in enumerate(status_list) if s.equals(status)]

        for i in eq_idxs:
            status_list.pop(i)


    @classmethod
    def _get_req_status(cls, body, key):
        ret = None
        if key in body:
            ret = body[key]
        return ret


    @classmethod
    def create_from_request(cls, body):
        return AppStatus(
                cls._get_req_status(body, cls.APP_STATUS_USER),
                cls._get_req_status(body, cls.APP_STATUS_EPIC),
                cls._get_req_status(body, cls.APP_STATUS_OPE),
                cls._get_req_status(body, cls.APP_STATUS_OPE_ID),
                Status.str_to_status(cls._get_req_status(body, cls.APP_STATUS_STATUS))
        )
    
    @classmethod
    def get_session_status(cls, status, app_session):
        if cls.APP_STATUS_SESSION_KEY not in app_session:
            raise ValueError()
        status_list = app_session[cls.APP_STATUS_SESSION_KEY]
        eq_idxs = [i for i, s in enumerate(status_list) if s.equals(status)]
        if len(eq_idxs) == 0:
            ret = None
        elif len(eq_idxs) == 1:
            ret = status_list[eq_idxs[0]]  
        else: 
            raise ValueError("session invalid values error")
        return ret

    @classmethod
    def _is_none_and_black(cls, val):
        return (val is not None) and len(val.strip()) > 0


    def is_not_none(self):
        return all([
                self._is_none_and_black(self.user),
                self._is_none_and_black(self.epic),
                self._is_none_and_black(self.operation)]
        )


    def equals(self, status):
        return all([
                self.user == status.user,
                self.epic == status.epic,
                self.operation == status.operation,
                self.operation_id == status.operation_id]
        )

class AppStatusManager(Manager):

    NO_VALUE_ERROR = "NO_VALUE_EROOR"
    INVALID_STATUS_ERROR = "INVALID_STATUS_ERROR"

    def setup(self):
        pass

    def start(self, request, body, app_session):

        # TODO ここで初期化するかは要検討 app session init
        if AppStatus.APP_STATUS_SESSION_KEY not in app_session:
            app_session[AppStatus.APP_STATUS_SESSION_KEY] = []
        # status check
        req_status = AppStatus.create_from_request(body)
        if not req_status.is_not_none():
            raise ManagerException(self.NO_VALUE_ERROR)

        session_status = AppStatus.get_session_status(req_status, app_session)
        if session_status is not None:
            if req_status.status < session_status.status:
                raise ManagerException(self.INVALID_STATUS_ERROR)

    def get_except_responce(
            self, exp, request, app_session):
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
            errpr_log['message'] = "invalid app status error"
            http_status = 401
        else:
            errpr_log['message'] = "some error app status"

        return JSONResponse(
                    content=error_log, 
                    status_code=http_status)
