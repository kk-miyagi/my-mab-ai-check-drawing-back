
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
        raise ManagerException(self.NOT_OVERRIDE_ERROR)

    def get_except_responce(
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
