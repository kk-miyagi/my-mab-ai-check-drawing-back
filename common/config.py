import json
import os


class AppConfig:

    def __init__(self, config_path):
        with open(config_path, 'r') as f:
            json_conf = json.load(f)

        self.__app_status_conf_init(json_conf)
        self.__logger_conf_init(json_conf)
        self.__batch_logger_conf_init(json_conf)
        self.__redis_conf_init(json_conf)
        self.__queue_conf_init(json_conf)
        self.__data_root_init()

    def __app_status_conf_init(self, conf):
        self._expire = conf['APP_STATUS']['expire']

    def __logger_conf_init(self, conf):
        c = conf['LOGGER']
        self._logger_name = c['logger_name']
        self._log_level = c['log_level']
        self._log_when = c['log_when']
        self._log_interval = c['log_interval']
        self._log_backup_count = c['log_backup_count']
        self._log_file_name = os.environ.get(
                'APP_LOG_FILE', c['log_file_name'])
        self._log_encoding = c['log_encoding']

    def __batch_logger_conf_init(self, conf):
        c = conf['BATCH_LOGGER']
        self._batch_logger_name = c['logger_name']
        self._batch_log_level = c['log_level']
        self._batch_log_when = c['log_when']
        self._batch_log_interval = c['log_interval']
        self._batch_log_backup_count = c['log_backup_count']
        self._batch_log_file_name = os.environ.get(
                'BATCH_LOG_FILE', c['log_file_name'])
        self._batch_log_encoding = c['log_encoding']

    def __redis_conf_init(self, conf):
        c = conf['REDIS']
        self._redis_host = os.environ.get('REDIS_HOST', c['host'])
        self._redis_port = int(os.environ.get('REDIS_PORT', c['port']))
        self._redis_password = os.environ.get('REDIS_PASSWORD', c['password'])
        ssl_env = os.environ.get('REDIS_SSL')
        if ssl_env is not None:
            self._redis_ssl = ssl_env.lower() in ('1', 'true', 'yes')
        else:
            self._redis_ssl = c['ssl']

    def __queue_conf_init(self, conf):
        q = conf.get('QUEUE', {})
        self._queue_stream = q.get('stream', 'jobs:batch')
        self._queue_group = q.get('group', 'batch-workers')
        self._queue_block_ms = int(q.get('block_ms', 5000))
        self._queue_max_retries = int(q.get('max_retries', 3))

    def __data_root_init(self):
        self._data_root = os.environ.get('DATA_ROOT', '.')

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
    def redis_host(self):
        return self._redis_host

    @property
    def redis_port(self):
        return self._redis_port

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
    def queue_block_ms(self):
        return self._queue_block_ms

    @property
    def queue_max_retries(self):
        return self._queue_max_retries

    @property
    def data_root(self):
        return self._data_root
