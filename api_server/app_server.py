import os
import threading

from starlette.requests import ClientDisconnect
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from common.config import AppConfig
from common.logger import AppLogger, BatchLogger
from common.app_state import AppState
from common.state.app_status import AppStatus

from api_server.app_manager import Managers
from api_server.app_router import AppRoute
from api_server.app_backend_task import BackendTasks
from api_server.manager.session_manager import SessionManager
from api_server.manager.app_status_manager import AppStatusManager
import api_server.router.issue_operation_id as issue_operation_id
import api_server.router.issue_group_id as issue_group_id
import api_server.router.status_list as status_list
import api_server.router.multi_fileupload as multi_fileupload
import api_server.router.epic_init as epic_init
import api_server.router.check_status as check_status
import api_server.router.create_label as create_label
import api_server.router.update_label as update_label
import api_server.router.drawing_review as drawing_review
import api_server.router.image_similarity as image_similarity
import api_server.router.drawing_compare as drawing_compare
import api_server.router.drawing_highlight as drawing_highlight
import api_server.router.update_label_init as update_label_init


MANAGERS = Managers()


class AppMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request, call_next):
        content_type = dict(request.headers).get('content-type', '')
        if (
              content_type == 'application/x-www-form-urlencoded' or
              content_type.startswith('multipart/form-data')):
            try:
                form_data = await request.form()
            except ClientDisconnect as dis:
                print(dis)
                return
            request.state.user = form_data.get('user')
            request.state.epic = form_data.get('epic')
            request.state.operation = form_data.get('operation')
            request.state.operation_id = form_data.get('operation_id')
            request.state.status = form_data.get('status')
            request.state.bf_file = form_data.get('bf_file')
            request.state.af_file = form_data.get('af_file')
            request.state.bf_file_csv = form_data.get('bf_file_csv')
            request.state.af_file_csv = form_data.get('af_file_csv')
            request.state.number = form_data.get('number')
            request.state.sum_number = form_data.get('sum_number')
            request.state.combinations = form_data.get('combinations')

            body_json = {
                'user': request.state.user,
                'epic': request.state.epic,
                'operation': request.state.operation,
                'operation_id': request.state.operation_id,
                'status': request.state.status,
            }
        elif content_type == 'application/json':
            body_json = await request.json()
            if 'user' in body_json:
                request.state.user = body_json['user']
            if 'epic' in body_json:
                request.state.epic = body_json['epic']
            if 'operation' in body_json:
                request.state.operation = body_json['operation']
            if 'operation_id' in body_json:
                request.state.operation_id = body_json['operation_id']
            if 'status' in body_json:
                request.state.status = body_json['status']
            if 'number' in body_json:
                request.state.number = body_json['number']
            if 'sum_number' in body_json:
                request.state.sum_number = body_json['sum_number']
            if 'combinations' in body_json:
                request.state.combinations = body_json['combinations']
            if 'rects' in body_json:
                request.state.rects = body_json['rects']
            if 'info' in body_json:
                request.state.info = body_json['info']
            request.state.body = body_json
        else:
            body_json = {}

        res = MANAGERS.start_managers(request, body_json)
        if res is not None:
            return res
        response = await call_next(request)

        return response


class AppServer():

    def __init__(self, run_env, host="0.0.0.0", port=8000):
        self.app = FastAPI()
        self.host = host
        self.port = port

        base_conf_dir = os.path.dirname(os.path.abspath(__file__))
        conf_path = os.path.join(base_conf_dir, 'conf', 'conf_dev.json')
        if run_env == 'PROD':
            conf_path = os.path.join(base_conf_dir, 'conf', 'conf_prod.json')

        self.conf = AppConfig(conf_path)
        self.logger = AppLogger(self.conf)
        self.batch_logger = BatchLogger(self.conf)

        origins = [f"http://{self.host}:{self.port}",
                   f"http://localhost:{self.port}",
                   f"http://127.0.0.1:{self.port}"]
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        self.app.add_middleware(AppMiddleware)

        app_state = AppState(
                self.app.state,
                threading.Lock(),
                self.conf,
                self.logger
        )
        self.app_state = app_state
        self.app_state.system_encode = 'utf-8'

        self.setup_managers(app_state)
        self.setup_routers(app_state)

        BackendTasks.setup(
            self.conf,
            self.app_state,
            self.batch_logger
        )

    def setup_managers(self, app_state: AppState):
        MANAGERS.add_manager(
                SessionManager(
                    self.app, app_state, self.logger))
        MANAGERS.add_manager(
                AppStatusManager(
                    self.app, app_state, self.logger))
        MANAGERS.setup_managers()

    def setup_routers(self, app_state: AppState):
        AppRoute.set_app_state(app_state)
        self.app.include_router(issue_operation_id.router)
        self.app.include_router(issue_group_id.router)
        self.app.include_router(status_list.router)
        self.app.include_router(multi_fileupload.router)
        self.app.include_router(epic_init.router)
        self.app.include_router(check_status.router)
        self.app.include_router(create_label.router)
        self.app.include_router(update_label.router)
        self.app.include_router(drawing_review.router)
        self.app.include_router(image_similarity.router)
        self.app.include_router(drawing_compare.router)
        self.app.include_router(drawing_highlight.router)
        self.app.include_router(update_label_init.router)

    def start(self, env_str):
        import uvicorn

        LOGGING_CONFIG = None
        if env_str == 'DEV':
            from api_server.conf.uvicorn_log_dev import LOGGING_CONFIG
        elif env_str == 'PROD':
            from api_server.conf.uvicorn_log_prod import LOGGING_CONFIG

        self.logger.log(
                AppStatus.get_dummy_status(),
                AppLogger.INFO,
                'APP SERVER START')
        uvicorn.run(
                self.app,
                host=self.host,
                port=self.port,
                log_config=LOGGING_CONFIG)
        self.logger.log(
                AppStatus.get_dummy_status(),
                AppLogger.INFO,
                'APP SERVER END')
