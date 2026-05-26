from common.state.app_status import AppStatus
from common.logger import AppLogger


class ManagerException(Exception):

    def __init__(self, message):
        self.message = message
        super().__init__(self.message)


class Manager:
    NOT_OVERRIDE_ERROR = "NOT_OVERRIDE_ERROR"

    def __init__(self, app, app_state, logger):
        self.app = app
        self.app_state = app_state
        self.logger = logger

    def setup(self):
        raise ManagerException(self.NOT_OVERRIDE_ERROR)

    def start(self, request, body):

        logger = self.get_manager_logger()
        logger.log(AppLogger.INFO, "START")
        self.child_start(request, body)
        logger.log(AppLogger.INFO, "END")

    def child_start(self, request, body):
        raise ManagerException(self.NOT_OVERRIDE_ERROR)

    def get_manager_logger(self):
        req_status = AppStatus.get_dummy_status()
        logger = self.logger
        class_name = self.__class__.__name__

        class manager_logger:
            def log(self, log_level, mess):
                logger.log(req_status, log_level, f"{class_name} {mess}")
        return manager_logger()

    def get_except_responce(
            self, exp, request):
        logger = self.get_manager_logger()
        logger.log(AppLogger.INFO, "except responce START")
        self.get_child_except_responce(exp, request)
        logger.log(AppLogger.INFO, "except responce END")

    def get_child_except_responce(
            self, exp, request):
        raise ManagerException(self.NOT_OVERRIDE_ERROR)


class Managers:

    def __init__(self):
        self.managers = []

    def add_manager(self, manager: Manager):
        self.managers.append(manager)

    def setup_managers(self):
        for m in self.managers:
            m.setup()

    def start_managers(self, request, body):
        ret = None
        for m in self.managers:
            try:
                m.start(request, body)
            except ManagerException as e:
                ret = m.get_except_responce(
                        e, request)
                continue

        return ret
