from dataclasses import dataclass
from enum import IntEnum
import json


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
        return [
                Operation(
                    x[cls.APP_STATUS_OPE],
                    x[cls.APP_STATUS_OPE_ID],
                    Status.str_to_status(x[cls.APP_STATUS_STATUS]))
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
                Status.str_to_status(
                    cls._get_req_status(body, cls.APP_STATUS_GRP_STATUS)
                ),
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
                Status.str_to_status(state.group_status),
                Operation.get_req_status(state.operations),
                state.others,
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

    @staticmethod
    def _status_to_int(val):
        # Status(IntEnum) はそのまま int 化。None / 文字列はそのまま保持。
        return int(val) if isinstance(val, int) else val

    @staticmethod
    def _int_to_status(val):
        return Status(val) if isinstance(val, int) else val

    def to_dict(self):
        """Redis 保存用に JSON シリアライズ可能な dict へ変換する。"""
        return {
            self.APP_STATUS_USER: self.user,
            self.APP_STATUS_EPIC: self.epic,
            self.APP_STATUS_GRP_ID: self.group_id,
            self.APP_STATUS_GRP_STATUS: self._status_to_int(self.group_status),
            self.APP_STATUS_OPERATIONS: [
                {
                    Operation.APP_STATUS_OPE: o.operation,
                    Operation.APP_STATUS_OPE_ID: str(o.operation_id),
                    Operation.APP_STATUS_STATUS: self._status_to_int(o.status),
                }
                for o in self.operations
            ],
            self.APP_STATUS_OTHERS: self.others,
            self.APP_STATUS_TIME: self.create_time,
        }

    @classmethod
    def from_dict(cls, d):
        operations = [
            Operation(
                o[Operation.APP_STATUS_OPE],
                o[Operation.APP_STATUS_OPE_ID],
                cls._int_to_status(o[Operation.APP_STATUS_STATUS]),
            )
            for o in d.get(cls.APP_STATUS_OPERATIONS, [])
        ]
        return cls(
            d[cls.APP_STATUS_USER],
            d[cls.APP_STATUS_EPIC],
            d[cls.APP_STATUS_GRP_ID],
            cls._int_to_status(d.get(cls.APP_STATUS_GRP_STATUS)),
            operations,
            d.get(cls.APP_STATUS_OTHERS, {}),
            d.get(cls.APP_STATUS_TIME, -1),
        )
