from state.app_status import AppStatus
from app_logger import AppLogger
from app_router import Status


class ManagerException(Exception):

    def __init__(self, message):
        self.message = message
        super().__init__(self.message)


class Manager:
    NOT_OVERRIDE_ERROR = "NOT_OVERRIDE_ERROR"

    def __init__(self, app, app_state, logger, app_login):
        self.app = app
        self.app_state = app_state
        self.logger = logger
        self.app_login = app_login

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
        ret = self.get_child_except_responce(exp, request)
        logger.log(AppLogger.INFO, "except responce END")
        return ret

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
                self.app_status_error(m, body)
                break

        return ret

    def app_status_error(self, manager, body):
        req_status = AppStatus.create_from_request(body)
        app_state = manager.app_state
        app_state.create_app_status()
        state_status = app_state.get_eq_app_status(req_status)
        if state_status is not None:
            # update_app_status は group_status を見るため、.status ではなく
            # group_status を ERROR にする（旧コードは .status を書いており無視されていた）。
            req_status.group_status = Status.ERROR
            manager.app_state.update_app_status(
                    req_status
            )
