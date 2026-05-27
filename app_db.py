from app_config import AppConfig
from app_logger import AppLogger
import sqlite3


class AppDB:

    def __init__(self, app_state, conf: AppConfig, logger: AppLogger):
        self.app_state = app_state
        self.conf = conf
        self.logger = logger
        self._db_init()

    def _db_init(self):
        with self._get_connect() as conn:
            conn.cursor()
            conn.execute(self.conf.create_user_table)

    def _get_connect(self):
        return sqlite3.connect(self.conf.db_name)

    def create_user(self):
        # TODO
        pass

    def get_user_hash(self, username):
        with self._get_connect() as conn:
            conn.cursor()
            user_hash = conn.execute(self.conf.get_user_table)
        return user_hash
