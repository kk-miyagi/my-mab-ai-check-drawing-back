from app_config import AppConfig
from logging.handlers import TimedRotatingFileHandler
import logging


class LoggerBase:
    DEBUG: int = 10
    INFO: int = 20
    WARNING: int = 30
    ERROR: int = 40
    CRITICAL: int = 50

    _INFO_KEY_LOGGER_NAME = 'logger_name'
    _INFO_KEY_LOG_LEVEL = 'log_level'
    _INFO_KEY_LOG_FILE = 'log_file_name'
    _INFO_KEY_LOG_WHEN = 'log_when'
    _INFO_KEY_LOG_TERM = 'log_interval'
    _INFO_KEY_LOG_FILE_CNT = 'log_backup_count'

    _FORMAT = '%(asctime)s - %(levelname)s - [%(name)s] - %(message)s'

    def __init__(self, conf: AppConfig):
        self.conf = conf
        self.log_info = self._get_log_info(conf)

        self.logger = logging.getLogger(
            self.log_info[self._INFO_KEY_LOGGER_NAME])
        self._set_log_level(
            self.logger,
            self.log_info[self._INFO_KEY_LOG_LEVEL]
        )

        formatter = logging.Formatter(
            self._FORMAT
        )

        # for file outpu
        file_handler = TimedRotatingFileHandler(
            self.log_info[self._INFO_KEY_LOG_FILE],
            self.log_info[self._INFO_KEY_LOG_WHEN],
            self.log_info[self._INFO_KEY_LOG_TERM],
            backupCount=self.log_info[self._INFO_KEY_LOG_FILE_CNT])

        file_handler.setFormatter(formatter)
        # for stdout
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)

        self.logger.addHandler(file_handler)
        self.logger.addHandler(stream_handler)

    def _get_log_info(self, app_conf):
        raise Exception("NOT OVERRIDE")

    def _set_log_level(self, logger, conf_loglevel):
        if conf_loglevel == 'DEBUG':
            logger.setLevel(logging.DEBUG)
        elif conf_loglevel == 'INFO':
            logger.setLevel(logging.INFO)
        elif conf_loglevel == 'WARNING':
            logger.setLevel(logging.WARNING)
        elif conf_loglevel == 'ERROR':
            logger.setLevel(logging.ERROR)
        elif conf_loglevel == 'CRITICAL':
            logger.setLevel(logging.CRITICAL)
        else:
            # TODO rase object
            raise conf_loglevel

    def log(self, app_status, log_level, message):
        mess = f"{app_status.user}::{app_status.epic}:{app_status.operation}"
        mess += f":{app_status.operation_id}:{app_status.status} -- {message}"
        match log_level:
            case self.DEBUG:
                self.logger.debug(mess)
            case self.INFO:
                self.logger.info(mess)
            case self.WARNING:
                self.logger.warning(mess)
            case self.ERROR:
                self.logger.error(mess)
            case self.CRITICAL:
                self.logger.critical(mess)


class AppLogger(LoggerBase):
    def _get_log_info(self, app_conf):
        return {
                self._INFO_KEY_LOGGER_NAME: app_conf.logger_name,
                self._INFO_KEY_LOG_LEVEL: app_conf.log_level,
                self._INFO_KEY_LOG_FILE: app_conf.log_file_name,
                self._INFO_KEY_LOG_WHEN: app_conf.log_when,
                self._INFO_KEY_LOG_TERM: app_conf.log_interval,
                self._INFO_KEY_LOG_FILE_CNT: app_conf.log_backup_count,
        }


class BatchLogger(LoggerBase):
    def _get_log_info(self, app_conf):
        return {
                self._INFO_KEY_LOGGER_NAME: app_conf.batch_logger_name,
                self._INFO_KEY_LOG_LEVEL: app_conf.batch_log_level,
                self._INFO_KEY_LOG_FILE: app_conf.batch_log_file_name,
                self._INFO_KEY_LOG_WHEN: app_conf.batch_log_when,
                self._INFO_KEY_LOG_TERM: app_conf.batch_log_interval,
                self._INFO_KEY_LOG_FILE_CNT: app_conf.batch_log_backup_count,
        }
