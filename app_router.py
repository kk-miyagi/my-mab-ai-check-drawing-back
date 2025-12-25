from fastapi import APIRouter
from state.app_status import Status


class AppRouter(APIRouter):

    @classmethod
    def set_app_state(cls, app_state):
        cls.app_state = app_state

    def create_responce_from_status(self, status):
        return {
            "user": status.user,
            "epic": status.epic,
            "operation": status.operation,
            "operation_id": status.operation_id,
            "status": Status.status_to_str(status.status)
        }
