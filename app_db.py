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
            cur = conn.cursor()
            cur.execute(self.conf.create_user_table)

    def _get_connect(self):
        return sqlite3.connect(self.conf.db_name)

    def create_user(self, user, pw_hash):
        with self._get_connect() as conn:
            cur = conn.cursor()
            cur.execute(
                    self.conf.insert_user_table,
                    (user, pw_hash)
            )

    def get_user_hash(self, username):
        ret = None
        with self._get_connect() as conn:
            cur = conn.cursor()
            cur.execute(self.conf.get_user_table, (username,))
            user_hash = cur.fetchone()
            if user_hash is not None:
                ret = user_hash[0]
        return ret
