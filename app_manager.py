
class ManagerException(Exception):

    def __init__(self, message):
        self.message = message
        super().__init__(self.message)

class Manager:
    NOT_OVERRIDE_ERROR = "NOT_OVERRIDE_ERROR"
    def __init__(self, app, logger):
        self.app = app
        self.logger = logger

    def setup(self):
        raise ManagerException(self.NOT_OVERRIDE_ERROR)

    def start(self, request, body, app_session):
        raise ManagerException(self.NOT_OVERRIDE_ERROR)

    def get_except_responce(
            self, exp, request, app_session):
        raise ManagerException(self.NOT_OVERRIDE_ERROR)

class Managers:

    def __init__(self):
        self.managers= []

    def add_manager(self, manager: Manager):
        self.managers.append(manager)

    def setup_managers(self):
        for m in self.managers:
            m.setup()


    def start_managers(self, request, body, app_session):
        ret = None
        for m in self.managers:
            try:
                m.start(request, body, app_session)
            except ManagerException as e:
                ret = m.get_except_responce(
                        e, request, app_session)
                continue

        return ret

