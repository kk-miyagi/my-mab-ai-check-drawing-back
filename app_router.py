from fastapi import APIRouter
import hello
import file_upload

class AppRouter:
    def __init__(self, app):
        self.app = app
        self.app.include_router(hello.router)
        self.app.include_router(file_upload.router)
