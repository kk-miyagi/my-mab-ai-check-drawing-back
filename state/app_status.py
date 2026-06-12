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

    APP_STATUS_USER = "user"
    APP_STATUS_EPIC = "epic"
    APP_STATUS_GRP_ID = "group_id"
    APP_STATUS_GRP_STATUS = "status"
    APP_STATUS_OPERATIONS = "operations"
    APP_STATUS_OTHERS = "others"
    APP_STATUS_TIME = "create_time"

    @classmethod
    def create_from_request(cls, body):
        return AppStatus(
            body.get('user'),
            body.get('epic'),
            body.get('group_id'),
            Status.str_to_status(body.get('group_status')),
            Operation.get_req_status(body.get('operations', [])),
            body.get('others', {}),
            -1
        )

    @classmethod
    def create_from_state(cls, state):
        return AppStatus(
            getattr(state, 'user', None),
            getattr(state, 'epic', None),
            getattr(state, 'group_id', None),
            Status.str_to_status(getattr(state, 'group_status', None)),
            Operation.get_req_status(getattr(state, 'operations', [])),
            getattr(state, 'others', {}),
            getattr(state, 'create_time', -1)
        )

    @classmethod
    def get_dummy_status(cls):
        return AppStatus(
            'SYSTEM', 'SYSTEM', 'SYSTEM', Status.START, [], {}, -1)

    @classmethod
    def _is_none_and_black(cls, val):
        return (val is None) or len(str(val).strip()) == 0

    def is_not_none(self):
        # キー生成に必要な識別子（user / epic / group_id）が揃っているか。
        return all([
            not self._is_none_and_black(self.user),
            not self._is_none_and_black(self.epic),
            not self._is_none_and_black(self.group_id),
        ])

    def get_hash_key(self):
        # app_status の Redis キーはグループ単位（user_epic_group_id）。
        # 1 グループ = 1 キーで operations を保持する。save/load が同一キーになる。
        # 成果物ディレクトリは別途 "{hash_key}_{operation}_{operation_id}" 命名のため、
        # retention はこの group キーを前方一致で配下の操作ディレクトリごと削除できる。
        return '_'.join([
            self.user or '',
            self.epic or '',
            self.group_id or '',
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
