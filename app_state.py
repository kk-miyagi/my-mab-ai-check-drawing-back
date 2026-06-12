import inspect
from types import MethodType
import state_func.app_status_func as app_status_func
import state_func.multi_fileupload_func as multi_fileupload_func
import state_func.boot_another_process_func as boot_another_process_func
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
        self.redis = redis
        self.add_state_methods()

    def get_members(self):
        # 各種app_stateを触る用の関数が定義されているmoduleを追加
        return [
            inspect.getmembers(app_status_func),
            inspect.getmembers(multi_fileupload_func),
            inspect.getmembers(boot_another_process_func)
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
