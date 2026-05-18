from dataclasses import dataclass
from enum import IntEnum


class Status(IntEnum):
    START = 0
    DOING = 1
    END = 2
    COMP = 3
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
        elif mess == "comp":
            ret = Status.COMP
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
        elif status == Status.COMP:
            ret = "comp"
        elif status == Status.ERROR:
            ret = "error"
        return ret


@dataclass
class Operation:
    operation: str
    operation_id: str
    status: Status

    APP_STATUS_OPE = "operation"
    APP_STATUS_OPE_ID = "operation_id"
    APP_STATUS_STATUS = "status"

    @classmethod
    def get_req_status(cls, body):
        # TODO
        return [
                Operation(
                    x[cls.APP_STATUS_OPE],
                    x[cls.APP_STATUS_OPE_ID],
                    x[cls.APP_STATUS])
                for x in body
        ]


@dataclass
class AppStatus:
    user: str
    epic: str
    group_id: str
    group_status: Status
    operations: list
    others: hash
    create_time: int

    APP_STATUS_SESSION_KEY = "APP_STATUS_SESSION_KEY"
    APP_STATUS_USER = "user"
    APP_STATUS_EPIC = "epic"
    APP_STATUS_GRP_ID = "group_id"
    APP_STATUS_GRP_STATUS = "group_status"
    APP_STATUS_OPERATIONS = "operations"
    APP_STATUS_OTHERS = "others"
    APP_STATUS_TIME = "create_time"

    @classmethod
    def _get_req_status(cls, body, key):
        ret = None
        if key in body:
            ret = body[key]
            if key == cls.APP_STATUS_OPERATIONS:
                ret = Operation.get_req_status(
                        body[cls.APP_STATUS_OPERATIONS])
        return ret

    @classmethod
    def create_from_request(cls, body):
        return AppStatus(
                cls._get_req_status(body, cls.APP_STATUS_USER),
                cls._get_req_status(body, cls.APP_STATUS_EPIC),
                cls._get_req_status(body, cls.APP_STATUS_GRP_ID),
                cls._get_req_status(body, cls.APP_STATUS_GRP_STATUS),
                cls._get_req_status(body, cls.APP_STATUS_OPERATIONS),
                cls._get_req_status(body, cls.APP_STATUS_OTHERS),
                -1
        )

    @classmethod
    def create_from_state(cls, state):
        return AppStatus(
                state.user,
                state.epic,
                state.group_id,
                Status.str_to_status(state.status),
                state.others,
                state.operations,
                -1
        )

    @classmethod
    def get_dummy_status(self):
        return AppStatus(
            'SYSTEM',
            'SYSTEM',
            'SYSTEM',
            'START',
            [],
            {},
            -1
        )

    @classmethod
    def _is_none_and_black(cls, val):
        return (val is None) or len(val.strip()) == 0

    def is_not_none(self):
        return all([
                not self._is_none_and_black(self.user),
                not self._is_none_and_black(self.epic),
                not self._is_none_and_black(self.group_id)]
        )

    def equals(self, status):
        return all([
                self.user == status.user,
                self.epic == status.epic,
                self.group_id == status.group_id]
        )

    def get_hash_key(self):
        return '_'.join([
            self.user,
            self.epic,
            self.group_id
        ])
