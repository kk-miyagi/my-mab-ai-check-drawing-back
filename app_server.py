import os
import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app_manager import Managers
from manager.session_manager import SessionManager
from app_router import AppRouter


MANAGERS = Managers()

class AppMiddleware(BaseHTTPMiddleware):
    
    async def dispatch(self, request, call_next):
        print(f"app middle ware request:{request}")
        # manager 処理の実行
        res = MANAGERS.start_managers(request)
        if res is not None:
            return res
        response = await call_next(request)

        return response


class AppServer():

    def getManagers(self):
        managers = Managers()
        # session manager
        managers.add_manager(SessionManager(
            self.app,
            self.logger
            )
        )

        return managers

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
            allow_methods=["*"],
            allow_headers=["*"],
        )
        # application sessionの作成
        self._APP_SESSION = {}

        # https dsipatvh
        self.app.add_middleware(AppMiddleware)

        # TODO session 
        MANAGERS.add_manager(SessionManager(self.app, self.logger))
        MANAGERS.setup_managers()

        # routing 実行
        self.router = AppRouter(self.app)


    def start(self):
        import uvicorn
        uvicorn.run(self.app, host=self.host, port=self.port)

