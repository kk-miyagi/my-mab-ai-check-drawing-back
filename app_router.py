from fastapi import APIRouter
from manager.app_status_manager import Status


class AppRouter(APIRouter):

    @classmethod
    def set_app_session(cls, app_session):
        cls.app_session = app_session

    def create_responce_from_status(self, status):
        return {
            "user": status.user,
            "epic": status.epic,
            "operation": status.operation,
            "operation_id": status.operation_id,
            "status": Status.status_to_str(status.status)
        }
