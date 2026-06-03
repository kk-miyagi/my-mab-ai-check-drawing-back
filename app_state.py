import inspect
from types import MethodType
import redis as redis_lib
import state_func.app_status_func as app_status_func
import state_func.multi_fileupload_func as multi_fileupload_func
import state_func.boot_another_process_func as boot_another_process_func
import state_func.drawing_highlight_func as drawing_highlight_func
import state_func.image_similarity_func as image_similarity_func
from app_config import AppConfig
from app_logger import AppLogger


class AppState:

    def __init__(self, app_state, lock, conf: AppConfig, logger: AppLogger,
                 redis=None):
        # app_state: FastAPI 側は request/app.state、batch 側は None。
        # redis: app_status をプロセス/コンテナ間で共有するためのクライアント。
        self.app_state = app_state
        self.lock = lock
        self.conf = conf
        self.logger = logger
<<<<<<< HEAD
        self.redis_client = redis_lib.Redis(
            host=conf.redis_host,
            port=conf.redis_port,
            password=conf.redis_password,
            ssl=conf.redis_ssl,
            decode_responses=True
        )
=======
        self.redis = redis
>>>>>>> f99d355 (build docker container separate backend_task (such as batch server) and fastapi server)
        self.add_state_methods()

    def get_members(self):
        return [
            inspect.getmembers(app_status_func),
            inspect.getmembers(multi_fileupload_func),
            inspect.getmembers(boot_another_process_func),
            inspect.getmembers(drawing_highlight_func),
            inspect.getmembers(image_similarity_func)
        ]

    def add_state_methods(self):
        for mems in self.get_members():
            for name, obj in mems:
                if inspect.isfunction(obj):
                    setattr(self, name, MethodType(obj, self))

    def getConf(self):
        return self.conf

    def getLogger(self):
        return self.logger
