import json


class AppConfig:

    __solts__ = (
        '_APP_STATUS_CONF_KEY',
        '_expire',
        '_BACKEND_TASKS_CONF_KEY',
        '_backend_tasks',
        '_LOGGER_CONF_KEY',
        '_logger_name',
        '_log_level',
        '_log_when',
        '_log_interval',
        '_log_backup_count',
        '_log_file_name',
        '_log_encoding',
        '_BATCH_LOGGER_CONF_KEY',
        '_batch_logger_name',
        '_batch_log_level',
        '_batch_log_when',
        '_batch_log_interval',
        '_batch_log_backup_count',
        '_batch_log_file_name',
        '_batch_log_encoding',
        '_initialized',
        '_DATABASE_CONF_KEY',
        '_db_name',
        '_create_user_table',
        '_insert_user_table',
        '_get_user_table',
        '_LOGIN_CONF_KEY',
        '_secret_key',
        '_algorithms',
        '_expire_min',
        '_secure_cookie'
    )

    def __init__(self, config_path):
        with open(config_path, 'r') as f:
            json_conf = json.load(f)

        # backend task cofig setting
        self.__backend_conf_init(json_conf)
        # redis / queue setting
        self.__redis_conf_init(json_conf)
        self.__queue_conf_init(json_conf)
        # app status setting
        self.__app_status_conf_init(json_conf)
        # log setting set config object
        self.__logger_conf_init(json_conf)
        # batch log setting set config object
        self.__batch_logger_conf_init(json_conf)
        # database config object
        self.__database_conf_init(json_conf)
        # login config object
        self.__login_conf_init(json_conf)

    def __backend_conf_init(self, json_conf):
        self.__setattr__("_BACKEND_TASKS_CONF_KEY", 'BACKEND_TASKS')
        self.__setattr__(
                '_backend_tasks', json_conf[self._BACKEND_TASKS_CONF_KEY]
        )

    def __database_conf_init(self, conf):
        self.__setattr__("_DATABASE_CONF_KEY", "DATABASE")
        db_conf = conf[self._DATABASE_CONF_KEY]
        self.__setattr__('_db_name', db_conf['db-name'])
        self.__setattr__('_create_user_table', db_conf['create-user-table'])
        self.__setattr__('_insert_user_table', db_conf['insert-user-table'])
        self.__setattr__('_get_user_table', db_conf['get-user-table'])

    def __login_conf_init(self, conf):
        self.__setattr__("_LOGIN_CONF_KEY", "LOGIN")
        db_conf = conf[self._LOGIN_CONF_KEY]
        self.__setattr__('_secret_key', db_conf['secret-key'])
        self.__setattr__('_algorithms', db_conf['algorithms'])
        self.__setattr__('_expire_min', db_conf['expire-min'])
        self.__setattr__('_secure_cookie', db_conf['secure-cookie'])

    @property
    def backend_tasks(self):
        return self._backend_tasks

    def __redis_conf_init(self, conf):
        self.__setattr__("_REDIS_CONF_KEY", 'REDIS')
        redis_conf = conf.get(self._REDIS_CONF_KEY, {})
        self.__setattr__('_redis_host', redis_conf.get('host', 'localhost'))
        self.__setattr__('_redis_port', redis_conf.get('port', 6379))
        self.__setattr__('_redis_db', redis_conf.get('db', 0))
        self.__setattr__('_redis_password', redis_conf.get('password', ''))
        self.__setattr__('_redis_ssl', redis_conf.get('ssl', False))

    def __queue_conf_init(self, conf):
        self.__setattr__("_QUEUE_CONF_KEY", 'QUEUE')
        queue_conf = conf.get(self._QUEUE_CONF_KEY, {})
        self.__setattr__('_queue_stream', queue_conf.get('stream', 'jobs:batch'))
        self.__setattr__('_queue_group', queue_conf.get('group', 'batch-workers'))
        self.__setattr__('_queue_consumer', queue_conf.get('consumer', ''))
        self.__setattr__('_queue_block_ms', queue_conf.get('block_ms', 5000))

    @property
    def redis_host(self):
        return self._redis_host

    @property
    def redis_port(self):
        return self._redis_port

    @property
    def redis_db(self):
        return self._redis_db

    @property
    def redis_password(self):
        return self._redis_password

    @property
    def redis_ssl(self):
        return self._redis_ssl

    @property
    def queue_stream(self):
        return self._queue_stream

    @property
    def queue_group(self):
        return self._queue_group

    @property
    def queue_consumer(self):
        return self._queue_consumer

    @property
    def queue_block_ms(self):
        return self._queue_block_ms

    def __app_status_conf_init(self, conf):
        self.__setattr__("_APP_STATUS_CONF_KEY", 'APP_STATUS')
        app_status_conf = conf[self._APP_STATUS_CONF_KEY]
        self.__setattr__(
                '_expire', app_status_conf['expire']
        )

    def __logger_conf_init(self, conf):
        self.__setattr__("_LOGGER_CONF_KEY", 'LOGGER')
        logger_conf = conf[self._LOGGER_CONF_KEY]
        self.__setattr__(
                '_logger_name', logger_conf['logger_name'])
        self.__setattr__(
                '_log_level', logger_conf['log_level'])
        self.__setattr__(
                '_log_when', logger_conf['log_when'])
        self.__setattr__(
                '_log_interval', logger_conf['log_interval'])
        self.__setattr__(
                '_log_backup_count', logger_conf['log_backup_count'])
        self.__setattr__(
                '_log_file_name', logger_conf['log_file_name'])
        self.__setattr__(
                '_log_encoding', logger_conf['log_encoding'])

    def __batch_logger_conf_init(self, conf):
        self.__setattr__("_BATCH_LOGGER_CONF_KEY", 'BATCH_LOGGER')
        logger_conf = conf[self._BATCH_LOGGER_CONF_KEY]
        self.__setattr__(
                '_batch_logger_name', logger_conf['logger_name'])
        self.__setattr__(
                '_batch_log_level', logger_conf['log_level'])
        self.__setattr__(
                '_batch_log_when', logger_conf['log_when'])
        self.__setattr__(
                '_batch_log_interval', logger_conf['log_interval'])
        self.__setattr__(
                '_batch_log_backup_count', logger_conf['log_backup_count'])
        self.__setattr__(
                '_batch_log_file_name', logger_conf['log_file_name'])
        self.__setattr__(
                '_batch_log_encoding', logger_conf['log_encoding'])

    @property
    def expire(self):
        return self._expire

    @property
    def logger_name(self):
        return self._logger_name

    @property
    def log_level(self):
        return self._log_level

    @property
    def log_when(self):
        return self._log_when

    @property
    def log_interval(self):
        return self._log_interval

    @property
    def log_backup_count(self):
        return self._log_backup_count

    @property
    def log_file_name(self):
        return self._log_file_name

    @property
    def log_encoding(self):
        return self._log_encoding

    @property
    def batch_logger_name(self):
        return self._batch_logger_name

    @property
    def batch_log_level(self):
        return self._batch_log_level

    @property
    def batch_log_when(self):
        return self._batch_log_when

    @property
    def batch_log_interval(self):
        return self._batch_log_interval

    @property
    def batch_log_backup_count(self):
        return self._batch_log_backup_count

    @property
    def batch_log_encoding(self):
        return self._batch_log_encoding

    @property
    def batch_log_file_name(self):
        return self._batch_log_file_name

    @property
    def db_name(self):
        return self._db_name

    @property
    def create_user_table(self):
        return self._create_user_table

    @property
    def insert_user_table(self):
        return self._insert_user_table

    @property
    def get_user_table(self):
        return self._get_user_table

    @property
    def get_secret_key(self):
        return self._secret_key

    @property
    def get_algorithms(self):
        return self._algorithms

    @property
    def get_expire_min(self):
        return self._expire_min

    @property
    def get_secure_cookie(self):
        return self._secure_cookie

    def __setattr__(self, key, value):
        # 属性変更禁止
        if hasattr(self, "_initialized"):
            raise AttributeError(f"{self.__class__.__name__} is immutable")
        super().__setattr__(key, value)

    def __delattr__(self, key):
        # 属性削除も禁止
        raise AttributeError(f"{self.__class__.__name__} is immutable")

    def __repr__(self):
        return f"{self.__class__.__name__}(x={self._x}, y={self._y})"
