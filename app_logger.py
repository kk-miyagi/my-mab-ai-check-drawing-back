from app_config import AppConfig
from logging.handlers import RotatingFileHandler
import logging


class AppLogger:
    DEBUG: int = 10
    INFO: int = 20
    WARNING: int = 30
    ERROR: int = 40
    CRITICAL: int = 50

    def __init__(self, conf: AppConfig):
        self.conf = conf
        self.logger = logging.getLogger(conf.logger_name)
        self._set_log_level(
                self.logger,
                conf.log_level
        )

        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - [%(name)s] - %(message)s'
        )

        # for file outpu
        file_handler = RotatingFileHandler(
                self.conf.log_file_name,
                maxBytes=self.conf.log_rotation_size*1024,
                backupCount=self.conf.log_backup_count)

        file_handler.setFormatter(formatter)
        # for stdout
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)

        self.logger.addHandler(file_handler)
        self.logger.addHandler(stream_handler)

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
