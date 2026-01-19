from dataclasses import dataclass
from enum import IntEnum


class Status(IntEnum):
    START = 0
    DOING = 1
    END = 2
    ERROR = -1

    @classmethod
    def str_to_status(cls, mess):
        ret = None
        if mess == "start":
            ret = Status.START
        elif mess == "doing":
            ret = Status.DOING
        elif mess == "end":
            ret = Status.END
        elif mess == "error":
            ret = Status.ERROR
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
        elif status == Status.ERROR:
            ret = "error"
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
    def get_dummy_status(self):
        return AppStatus(
            'SYSTEM',
            'SYSTEM',
            'SYSTEM',
            'SYSTEM',
            'START',
        )

    @classmethod
    def delete_session_status(cls, status, app_session):
        if not hasattr(app_session, 'APP_STATUS_SESSION_KEY'):
            raise ValueError()
        status_dic = app_session.APP_STATUS_SESSION_KEY
        delete_status = None
        for key in status_dic.keys():
            if key == status.get_hash_key():
                delete_key = key
                delete_status = status
                continue
        if delete_status is not None:
            status_dic.pop(delete_key)

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
