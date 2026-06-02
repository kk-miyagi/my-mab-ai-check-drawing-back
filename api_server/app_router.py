from fastapi.routing import APIRoute
from fastapi import Request, Response
from common.state.app_status import Status, AppStatus
from common.logger import AppLogger
from typing import Any, Callable, Coroutine


class AppRoute(APIRoute):

    @classmethod
    def set_app_state(cls, app_state):
        cls.app_state = app_state

    @classmethod
    def get_app_state(cls):
        return cls.app_state

    @classmethod
    def create_responce_from_status(cls, status):
        return {
            "user": status.user,
            "epic": status.epic,
            "operation": status.operation,
            "operation_id": status.operation_id,
            "status": Status.status_to_str(status.status),
            "create_time": status.create_time
        }

    def get_route_handler(
            self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request) -> Response:
            logger = self.app_state.getLogger()
            state = request.state
            req_str = "custom route handler"
            req_str += f"\nuser:{hasattr(state, 'user')}"
            req_str += f"\nepic:{hasattr(state, 'epic')}"
            req_str += f"\noperation:{hasattr(state, 'operation')}"
            req_str += f"\noperation_id:{hasattr(state, 'operation_id')}"
            req_str += f"\nstatus:{hasattr(state, 'status')}"
            logger.log(
                AppStatus.get_dummy_status(),
                AppLogger.DEBUG,
                req_str
            )
            req_status = AppStatus.create_from_state(request.state)
            url = '/'.join(str(request.url).split('/')[3:])
            logger.log(req_status, AppLogger.INFO, f"routing [{url}] START")
            response = await original_route_handler(request)
            logger.log(req_status, AppLogger.INFO, f"routing [{url}] END")
            return response

        return custom_route_handler
