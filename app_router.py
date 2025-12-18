from fastapi import APIRouter

class AppRouter(APIRouter):

    @classmethod
    def set_app_session(cls, app_session):
        cls.app_session = app_session
