from starlette.requests import ClientDisconnect
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app_manager import Managers
from app_state import AppState
from manager.session_manager import SessionManager
from manager.app_status_manager import AppStatusManager
from manager.login_manager import LoginManager
from app_router import AppRoute
from app_config import AppConfig
from app_logger import AppLogger, BatchLogger
from app_db import AppDB
from app_login import AppLogin
from app_backend_task import BackendTasks
from app_redis import create_redis_client
from state.app_status import AppStatus
import os
import router.issue_operation_id as issue_operation_id
import router.login as login
import router.issue_group_id as issue_group_id
import router.status_list as status_list
import router.multi_fileupload as multi_fileupload
import router.epic_init as epic_init
import router.check_status as check_status
import router.create_label as create_label
import router.update_label as update_label
import router.drawing_review as drawing_review
import router.image_similarity as image_similarity
import router.drawing_compare as drawing_compare
import router.drawing_highlight as drawing_highlight
import router.update_label_init as update_label_init
import threading
import json


# 各種マネージャー格納用
MANAGERS = Managers()


class AppMiddleware(BaseHTTPMiddleware):

    # router側ではリクエスト内容を基本stateオブジェクトから取得する
    async def dispatch(self, request, call_next):
        # manager 処理の実行
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
            request.state.group_id = form_data.get('group_id')
            request.state.group_status = form_data.get('group_status')
            request.state.operations = json.loads(form_data.get('operations'))
            request.state.others = json.loads(form_data.get('others'))
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
                         'group_id': request.state.group_id,
                         'operations': request.state.operations,
                         'others': request.state.others,
                         'group_status': request.state.group_status
            }
        elif content_type == 'application/json':
            body_json = await request.json()
            if 'user' in body_json:
                request.state.user = body_json['user']
            if 'epic' in body_json:
                request.state.epic = body_json['epic']
            if 'operations' in body_json:
                request.state.operations = body_json['operations']
            if 'others' in body_json:
                request.state.others = body_json['others']
            if 'group_id' in body_json:
                request.state.group_id = body_json['group_id']
            if 'group_status' in body_json:
                request.state.group_status = body_json['group_status']
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

        res = MANAGERS.start_managers(request, body_json)
        if res is not None:
            return res
        response = await call_next(request)

        return response


class AppServer():

    def __init__(self, run_env, host="127.0.0.1", port=8000):

        # FastAPI アプリケーションの作成
        self.app = FastAPI()
        # コンテナ実行時は API_HOST=0.0.0.0 等を環境変数で上書きする
        self.host = os.environ.get("API_HOST", host)
        self.port = int(os.environ.get("API_PORT", port))
        # config setting
        conf_path = './conf/conf_dev.json'
        if run_env == 'PROD':
            conf_path = './conf/conf_prod.json'

        self.conf = AppConfig(conf_path)
        self.logger = AppLogger(self.conf)
        self.batch_logger = BatchLogger(self.conf)
        # ステータス共有 / ジョブ配信用 Redis クライアント
        self.redis = create_redis_client(self.conf)
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
                self.logger,
                self.redis
        )
        self.app_state = app_state
        self.app_state.system_encode = 'utf-8'
        self.app_db = AppDB(
                self.app.state,
                self.conf,
                self.logger
        )
        self.app_login = AppLogin(
            self.conf
        )
        # manager setup
        self.setup_managers(app_state)

        # routing setup
        self.setup_routers(
             app_state,
             self.app_db,
             self.app_login
        )

        # backend task setu
        # batch original logger
        BackendTasks.setup(
            self.conf,
            self.app_state,
            self.batch_logger,
            self.redis
        )

    def setup_managers(self, app_state: AppState):
        MANAGERS.add_manager(
                SessionManager(
                    self.app, app_state, self.logger, self.app_login))
        MANAGERS.add_manager(
                AppStatusManager(
                    self.app, app_state, self.logger, self.app_login))
        MANAGERS.add_manager(
                LoginManager(
                    self.app, app_state, self.logger, self.app_login))
        MANAGERS.setup_managers()

    def setup_routers(self, app_state: AppState, app_db: AppDB,
                      app_login: AppLogin):
        AppRoute.setup(
            app_state,
            app_db,
            app_login
        )
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
        self.app.include_router(login.router)

    def start(self, env_str):
        import uvicorn

        LOGGING_CONFIG = None
        if env_str == 'DEV':
            from conf.uvicorn_log_dev import LOGGING_CONFIG
        elif env_str == 'PROD':
            from conf.uvicorn_log_prod import LOGGING_CONFIG

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
