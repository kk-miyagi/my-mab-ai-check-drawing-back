import inspect
from types import MethodType
import state_func.app_status_func as app_status_func
import state_func.multi_fileupload_func as multi_fileupload_func
import state_func.boot_another_process_func as boot_another_process_func


class AppState:

    def __init__(self, app_state, lock):
        self.app_state = app_state
        self.lock = lock
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
                    print(f"AppState init add method:{obj}")
                    setattr(self, name, MethodType(obj, self))
