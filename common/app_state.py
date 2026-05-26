import inspect
from types import MethodType
import common.state_func.app_status_func as app_status_func
import common.state_func.multi_fileupload_func as multi_fileupload_func
import common.state_func.boot_another_process_func as boot_another_process_func
import common.state_func.drawing_highlight_func as drawing_highlight_func
import common.state_func.image_similarity_func as image_similarity_func
from common.config import AppConfig
from common.logger import LoggerBase
from common.redis_client import create_redis_client


class AppState:
    """Shared state holder used by both api_server and batch_server.

    Binds Redis-backed state functions (state_func/*) as methods so callers
    can do `app_state.get_app_status(...)`, `app_state.update_app_status(...)`,
    etc.

    `app_state` is the FastAPI request-scoped state object on the API side, or
    None on the batch side (workers don't need a request state).
    """

    def __init__(
            self,
            app_state,
            lock,
            conf: AppConfig,
            logger: LoggerBase):
        self.app_state = app_state
        self.lock = lock
        self.conf = conf
        self.logger = logger
        self.redis_client = create_redis_client(conf)
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
