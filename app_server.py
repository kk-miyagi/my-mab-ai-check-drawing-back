from starlette.requests import ClientDisconnect
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app_manager import Managers
from app_state import AppState
from manager.session_manager import SessionManager
from manager.app_status_manager import AppStatusManager
from app_router import AppRoute
from app_config import AppConfig
from app_logger import AppLogger
from state.app_status import AppStatus
import router.issue_operation_id as issue_operation_id
import router.multi_fileupload as multi_fileupload
import router.epic_init as epic_init
import router.boot_another_process as boot_another_process
import threading


# 各種マネージャー格納用
MANAGERS = Managers()


class AppMiddleware(BaseHTTPMiddleware):

    # router側ではリクエスト内容を基本stateオブジェクトから取得する
    async def dispatch(self, request, call_next):
        # manager 処理の実行
        print(f"app midele ware request header: {request.headers}")
        content_type = dict(request.headers)['content-type']
        if (
              content_type == 'application/x-www-form-urlencoded' or
              content_type.startswith('multipart/form-data')):
            try:
                form_data = await request.form()
            except ClientDisconnect as dis:
                # TODO client disconnect発生時は一旦何もせず終了
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

            body_json = {
                         'user': request.state.user,
                         'epic': request.state.epic,
                         'operation': request.state.operation,
                         'operation_id': request.state.operation_id,
                         'status': request.state.status
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
            request.state.body = body_json
        print(f"app middle ware request body:{body_json}")

        res = MANAGERS.start_managers(request, body_json)
        if res is not None:
            return res
        response = await call_next(request)

        return response


class AppServer():

    def __init__(self, run_env, host="127.0.0.1", port=8000):

        # FastAPI アプリケーションの作成
        self.app = FastAPI()
        self.host = host
        self.port = port
        # config setting
        conf_path = './conf/conf_dev.json'
        if run_env == 'PROD':
            conf_path = './conf/conf_prod.json'

        self.conf = AppConfig(conf_path)
        self.logger = AppLogger(self.conf)
        origins = [f"http://{self.host}:{self.port}",]
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            # TODO
            allow_methods=["*"],
            # TODO
            allow_headers=["*"],
        )

        # https dsipatvh
        self.app.add_middleware(AppMiddleware)

        app_state = AppState(
                self.app.state,
                threading.Lock(),
                self.conf,
                self.logger
        )
        self.app_state = app_state
        # manager setup
        self.setup_managers(app_state)

        # routing setup
        self.setup_routers(app_state)

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
        self.app.include_router(multi_fileupload.router)
        self.app.include_router(epic_init.router)
        self.app.include_router(boot_another_process.router)

    def start(self):
        import uvicorn

        self.logger.log(
                AppStatus.get_dummy_status(),
                AppLogger.INFO,
                'APP SERVER START')
        uvicorn.run(self.app, host=self.host, port=self.port)
        self.logger.log(
                AppStatus.get_dummy_status(),
                AppLogger.INFO,
                'APP SERVER END')
