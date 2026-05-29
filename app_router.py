from fastapi.routing import APIRoute
from fastapi import Request, Response
from state.app_status import Status
from state.app_status import AppStatus
from app_logger import AppLogger
from typing import Any, Callable, Coroutine


class AppRoute(APIRoute):

    @classmethod
    def setup(cls, app_state, app_db, app_login):
        cls.app_state = app_state
        cls.app_db = app_db
        cls.app_login = app_login

    @classmethod
    def get_app_state(cls):
        return cls.app_state

    @classmethod
    def get_app_db(cls):
        return cls.app_db

    @classmethod
    def get_app_login(cls):
        return cls.app_login

    @classmethod
    def create_responce_from_status(cls, status):
        return {
            "user": status.user,
            "epic": status.epic,
            "group_id": status.group_id,
            "operations": [{
                "operation": ope.operation,
                "operation_id": ope.operation_id,
                "status": Status.status_to_str(ope.status)
            } for ope in status.operations],
            "others": status.others,
            "group_status": Status.status_to_str(status.group_status),
            "create_time": status.create_time
        }

    def get_route_handler(
            self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request) -> Response:
            logger = self.app_state.getLogger()
            state = request.state
            req_str = "custom route hander"
            req_str += " request state hasattr chek"
            req_str += f"\nuser:{hasattr(state, 'user')}"
            req_str += f"\nepic:{hasattr(state, 'epic')}"
            req_str += f"\ngroup_id:{hasattr(state, 'group_id')}"
            req_str += f"\noperations:{hasattr(state, 'operations')}"
            req_str += f"\nothers:{hasattr(state, 'others')}"
            req_str += f"\ngroup_status:{hasattr(state, 'group_status')}"
            # RODO other attr
            logger.log(
                AppStatus.get_dummy_status(),
                AppLogger.DEBUG,
                req_str
            )
            req_status = AppStatus.create_from_state(request.state)
            url = '/'.join(str(request.url).split('/')[3:])
            logger.log(
                req_status,
                AppLogger.INFO,
                f"routing [{url}] START")
            response = await original_route_handler(request)
            logger.log(
                req_status,
                AppLogger.INFO,
                f"routing [{url}] END")
            return response

        return custom_route_handler
