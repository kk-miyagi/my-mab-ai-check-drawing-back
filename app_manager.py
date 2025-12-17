
class ManagerException(Exception):
   pass

class Manager:
    def __init__(self, app, logger):
        self.app = app
        self.logger = logger

    def setup(self):
        raise ManagerException()

    def start(self, request):
        raise ManagerException()

    def get_except_responce(self, exp, request):
        raise ManagerException()

class Managers:

    def __init__(self):
        self.managers= []

    def add_manager(self, manager: Manager):
        self.managers.append(manager)

    def setup_managers(self):
        for m in self.managers:
            m.setup()


    def start_managers(self, request):
        ret = None
        for m in self.managers:
            try:
                m.start(request)
            except ManagerException as e:
                ret = m.get_except_responce(e, request)
                continue

        return ret

