import json
import pytest
import retention_config


def _write_conf(tmp_path, env, data):
    conf_dir = tmp_path / "conf"
    conf_dir.mkdir(exist_ok=True)
    p = conf_dir / f"retention_conf_{env.lower()}.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    return conf_dir


VALID = {
    "RETENTION": {"storage_expire_sec": 604800},
    "REDIS": {"host": "h", "port": 6380, "password": "", "ssl": True},
    "API_BASE_URL": "http://localhost:8000",
    "API_KEY": "k",
}


def test_load_config_reads_env_file(tmp_path):
    conf_dir = _write_conf(tmp_path, "DEV", VALID)
    cfg = retention_config.load_config("DEV", base_dir=str(conf_dir))
    assert cfg["RETENTION"]["storage_expire_sec"] == 604800


def test_load_config_rejects_invalid_env(tmp_path):
    with pytest.raises(ValueError):
        retention_config.load_config("STAGING", base_dir=str(tmp_path))


def test_load_config_requires_mandatory_keys(tmp_path):
    bad = {"REDIS": {}, "API_BASE_URL": "x", "API_KEY": "k"}  # no RETENTION
    conf_dir = _write_conf(tmp_path, "DEV", bad)
    with pytest.raises(KeyError):
        retention_config.load_config("DEV", base_dir=str(conf_dir))
