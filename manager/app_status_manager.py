from fastapi.responses import JSONResponse
from app_manager import Manager, ManagerException
from dataclasses import dataclass
from enum import IntEnum
import uuid as uu


class Status(IntEnum):
    START = 0
    DOING = 1
    END = 2

    @classmethod
    def str_to_status(cls, mess):
        ret = None
        print(f"str_to_status input: {mess}")
        if mess == "start":
            ret = Status.START
        elif mess == "doing":
            ret = Status.DOING
        elif mess == "end":
            ret = Status.END
        print(f"str_to_status ret: {ret}")
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
            app_session[cls.APP_STATUS_SESSION_KEY] = {}

        status_dic = app_session[cls.APP_STATUS_SESSION_KEY]
        ret_id = status.operation_id
        if cls._is_none_and_black(ret_id):
            ret_id = str(uu.uuid4())

        ret = AppStatus(
                status.user,
                status.epic,
                status.operation,
                ret_id,
                status.status
        )
        status_dic[ret.get_hash_key()] = ret
        return ret

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
                Status.str_to_status(
                    cls._get_req_status(body, cls.APP_STATUS_STATUS))
        )

    @classmethod
    def create_from_state(cls, state):
        return AppStatus(
                state.user,
                state.epic,
                state.operation,
                state.operation_id,
                Status.str_to_status(state.status)
        )

    @classmethod
    def get_session_status(cls, status, app_session):
        if cls.APP_STATUS_SESSION_KEY not in app_session:
            raise ValueError()
        status_dic = app_session[cls.APP_STATUS_SESSION_KEY]
        print(status.operation_id)
        if cls._is_none_and_black(status.operation_id):
            ret = None
        elif status.get_hash_key() not in status_dic:
            ret = None
        else:
            ret = status_dic[status.get_hash_key()]
        return ret

    @classmethod
    def update_session_status(cls, status, app_session):
        if cls.APP_STATUS_SESSION_KEY not in app_session:
            raise ValueError()
        status_dic = app_session[cls.APP_STATUS_SESSION_KEY]
        update_status = None
        for key in status_dic.keys():
            print(f"update key checck session:{key}")
            print(f"update request:{status.get_hash_key()}")
            if key == status.get_hash_key():
                update_key = key
                update_status = status
                continue
        if update_status is not None:
            print("upadte app session status!!")
            status_dic[update_key] = update_status

    @classmethod
    def _is_none_and_black(cls, val):
        return (val is None) or len(val.strip()) == 0

    def is_not_none(self):
        return all([
                not self._is_none_and_black(self.user),
                not self._is_none_and_black(self.epic),
                not self._is_none_and_black(self.operation)]
        )

    def equals(self, status):
        return all([
                self.user == status.user,
                self.epic == status.epic,
                self.operation == status.operation,
                self.operation_id == status.operation_id]
        )

    def get_hash_key(self):
        return '_'.join([
            self.user,
            self.epic,
            self.operation,
            self.operation_id
        ])


class AppStatusManager(Manager):

    NO_VALUE_ERROR = "NO_VALUE_EROOR"
    INVALID_STATUS_ERROR = "INVALID_STATUS_ERROR"

    def setup(self):
        pass

    def start(self, request, body, app_session):

        # app_session init
        if AppStatus.APP_STATUS_SESSION_KEY not in app_session:
            app_session[AppStatus.APP_STATUS_SESSION_KEY] = {}
        # status check
        req_status = AppStatus.create_from_request(body)
        if not req_status.is_not_none():
            raise ManagerException(self.NO_VALUE_ERROR)

        session_status = AppStatus.get_session_status(req_status, app_session)
        if session_status is not None:
            print(f"req status: {req_status.status}")
            print(f"session_status:{session_status.status}")
            if (
                    (req_status.status < session_status.status) or
                    (req_status.status - session_status.status > 1)):
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
            error_log['message'] = "invalid app status error"
            http_status = 401
        else:
            error_log['message'] = "some error app status"

        return JSONResponse(
                    content=error_log,
                    status_code=http_status)
