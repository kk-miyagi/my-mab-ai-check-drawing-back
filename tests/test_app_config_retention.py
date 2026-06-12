from app_config import AppConfig


def test_dev_conf_loads_retention_and_ttl():
    conf = AppConfig('./conf/conf_dev.json')
    assert conf.data_retention_storage_expire_sec == 2592000  # 30 ngày
    assert conf.expire == 3024000                             # TTL 35 ngày
    assert "./multi-fileupload" in conf.data_retention_source_dirs


def test_prod_conf_loads_retention_and_ttl():
    conf = AppConfig('./conf/conf_prod.json')
    assert conf.data_retention_storage_expire_sec == 2592000
    assert conf.expire == 3024000


def test_old_retention_keys_removed():
    conf = AppConfig('./conf/conf_dev.json')
    assert not hasattr(conf, 'data_retention_api_key')
    assert not hasattr(conf, 'data_retention_deletion_dir')
