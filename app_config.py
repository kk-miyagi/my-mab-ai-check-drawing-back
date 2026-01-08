import json


class AppConfig:

    __solts__ = (
        '_LOGGER_CONF_KEY',
        '_logger_name',
        '_log_level',
        '_log_when',
        '_log_interval',
        '_log_backup_count',
        '_log_file_name',
        '_initialized'
    )

    def __init__(self, config_path):
        self.__setattr__("_LOGGER_CONF_KEY", 'LOGGER')
        with open(config_path, 'r') as f:
            json_conf = json.load(f)
        # log setting set config object
        self.__logger_conf_init(json_conf[self._LOGGER_CONF_KEY])
        # TODO another cofig setting

    def __logger_conf_init(self, logger_conf):
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
