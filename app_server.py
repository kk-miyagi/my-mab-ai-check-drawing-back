import os
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app_manager import Managers
from manager.session_manager import SessionManager
from manager.app_status_manager import AppStatusManager
from app_router import AppRouter
import router.hello as hello
import router.file_upload as file_upload 
import router.issue_operation_id as issue_operation_id 
import router.multi_fileupload as multi_fileupload


# 各種マネージャー格納用
MANAGERS = Managers()
# application session用
APP_SESSION = {}

class AppMiddleware(BaseHTTPMiddleware):
    
    async def dispatch(self, request, call_next):
        # manager 処理の実行
        print(f"app midele ware request header: {request.headers}")
        content_type = dict(request.headers)['content-type'] 
        if (content_type == 'application/x-www-form-urlencoded' or
            content_type.startswith('multipart/form-data')):
            form_data = await request.form()
            
            request.state.user = form_data.get('user')
            request.state.epic = form_data.get('epic')
            request.state.operation = form_data.get('operation')
            request.state.operation_id = form_data.get('operation_id')
            request.state.status = form_data.get('status')
            request.state.file_1 = form_data.get('file_1')
            request.state.file_2 = form_data.get('file_2')

            body_json = { 
                         'user': request.state.user,
                         'epic': request.state.epic,
                         'operation': request.state.operation,
                         'operation_id': request.state.operation_id,
                         'status': request.state.status
            }
        elif content_type == 'application/json':
            body_json = await request.json()
        print(f"app middle ware request body:{body_json}")

        res = MANAGERS.start_managers(request, body_json, APP_SESSION)
        if res is not None:
            return res
        response = await call_next(request)

        return response


class AppServer():

    def __init__(self, host="127.0.0.1", port=8000):

        self.logger = logging.getLogger(__name__)

        # FastAPI アプリケーションの作成
        self.app = FastAPI()
        self.host = host
        self.port = port
        origins = [f"http://{self.host}:{self.port}",]

        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"], # TODO
            allow_headers=["*"], # TODO
        )

        # https dsipatvh
        self.app.add_middleware(AppMiddleware)

        # manager setup 
        self.setup_managers()

        # routing setup
        self.setup_routers()


    def setup_managers(self):
        MANAGERS.add_manager(SessionManager(self.app, self.logger))
        MANAGERS.add_manager(AppStatusManager(self.app, self.logger))
        MANAGERS.setup_managers()

    def setup_routers(self):
        AppRouter.set_app_session(APP_SESSION)
        self.app.include_router(hello.router)
        self.app.include_router(file_upload.router)
        self.app.include_router(issue_operation_id.router)
        self.app.include_router(multi_fileupload.router)
 
    def start(self):
        import uvicorn
        uvicorn.run(self.app, host=self.host, port=self.port)

