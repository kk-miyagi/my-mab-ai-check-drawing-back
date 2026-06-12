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
    "REDIS": {"host": "h", "port": 6380, "password": "", "ssl": True},
    "QUEUE": {"stream": "jobs:batch"},
}


def test_load_config_reads_env_file(tmp_path):
    conf_dir = _write_conf(tmp_path, "DEV", VALID)
    cfg = retention_config.load_config("DEV", base_dir=str(conf_dir))
    assert cfg["QUEUE"]["stream"] == "jobs:batch"


def test_load_config_rejects_invalid_env(tmp_path):
    with pytest.raises(ValueError):
        retention_config.load_config("STAGING", base_dir=str(tmp_path))


def test_load_config_requires_mandatory_keys(tmp_path):
    bad = {"REDIS": {"host": "h", "port": 1, "password": ""}}  # thiếu QUEUE
    conf_dir = _write_conf(tmp_path, "DEV", bad)
    with pytest.raises(KeyError):
        retention_config.load_config("DEV", base_dir=str(conf_dir))
