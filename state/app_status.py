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
        mapping = {
            "start": Status.START,
            "doing": Status.DOING,
            "end": Status.END,
            "comp": Status.COMP,
            "error": Status.ERROR,
        }
        return mapping.get(mess)

    @classmethod
    def status_to_str(cls, status):
        mapping = {
            Status.START: "start",
            Status.DOING: "doing",
            Status.END: "end",
            Status.COMP: "comp",
            Status.ERROR: "error",
        }
        return mapping.get(status)


@dataclass
class AppStatus:
    user: str
    epic: str
    operation: str
    operation_id: str
    status: Status
    create_time: float

    @classmethod
    def create_from_request(cls, body):
        return AppStatus(
            body.get('user'),
            body.get('epic'),
            body.get('operation'),
            body.get('operation_id'),
            Status.str_to_status(body.get('status')),
            -1
        )

    @classmethod
    def create_from_state(cls, state):
        return AppStatus(
            getattr(state, 'user', None),
            getattr(state, 'epic', None),
            getattr(state, 'operation', None),
            getattr(state, 'operation_id', None),
            Status.str_to_status(getattr(state, 'status', None)),
            -1
        )

    @classmethod
    def get_dummy_status(cls):
        return AppStatus('SYSTEM', 'SYSTEM', 'SYSTEM', 'SYSTEM', Status.START, -1)

    @classmethod
    def _is_none_and_black(cls, val):
        return (val is None) or len(str(val).strip()) == 0

    def is_not_none(self):
        return all([
            not self._is_none_and_black(self.user),
            not self._is_none_and_black(self.epic),
            not self._is_none_and_black(self.operation_id),
        ])

    def get_hash_key(self):
        return '_'.join([
            self.user or '',
            self.epic or '',
            self.operation or '',
            self.operation_id or ''
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
