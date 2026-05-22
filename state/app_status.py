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
